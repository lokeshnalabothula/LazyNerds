from datetime import datetime, timezone
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.core.security import hash_password
from app.models.client import Client
from app.models.user import User
from app.models.registration import ClientRegistration
from app.models.notification import Notification
from app.schemas.registration import ClientRegisterInput
from app.services.audit_service import log_audit


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def register_client(db: Session, reg_in: ClientRegisterInput) -> ClientRegistration:
    """
    Submits a public client self-registration in pending status.
    Strictly isolated from employee directory queries.
    """
    normalized_email = reg_in.email.strip().lower()

    # Check if active approved user already exists
    existing_user = (
        db.query(User)
        .filter(func.lower(func.trim(User.email)) == normalized_email)
        .first()
    )
    if existing_user and existing_user.role in ("client", "employee", "founder", "admin"):
        raise ValueError("An account is already registered with this email address. Please sign in.")

    # Check for existing pending registration
    existing_reg = (
        db.query(ClientRegistration)
        .filter(func.lower(func.trim(ClientRegistration.email)) == normalized_email)
        .order_by(desc(ClientRegistration.created_at))
        .first()
    )
    if existing_reg and existing_reg.status == "pending":
        raise ValueError("A registration submission for this email is already currently pending founder review.")


    # Hash credentials securely
    hashed_pwd = hash_password(reg_in.password)

    registration = ClientRegistration(
        full_name=reg_in.full_name.strip(),
        email=normalized_email,
        hashed_password=hashed_pwd,
        phone=reg_in.phone.strip() if reg_in.phone else None,
        job_title=reg_in.job_title.strip() if reg_in.job_title else None,
        company_name=reg_in.company_name.strip(),
        website=reg_in.website,
        industry=reg_in.industry.strip() if reg_in.industry else None,
        company_size=reg_in.company_size.strip() if reg_in.company_size else None,
        country=reg_in.country.strip() if reg_in.country else None,
        requested_services=reg_in.requested_services.strip() if reg_in.requested_services else None,
        scope_description=reg_in.scope_description.strip() if reg_in.scope_description else None,
        primary_domains=reg_in.primary_domains.strip() if reg_in.primary_domains else None,
        status="pending",
        created_at=utc_now(),
        updated_at=utc_now(),
    )
    db.add(registration)
    db.commit()
    db.refresh(registration)

    # Notify founder(s) of pending registration
    founders = db.query(User).filter(User.role.in_(["founder", "admin"])).all()
    for founder in founders:
        notif = Notification(
            recipient_email=founder.email,
            title="New Client Registration Request",
            message=f"{registration.full_name} from '{registration.company_name}' submitted an onboarding request.",
            notification_type="system",
            link="/registrations",
            created_at=utc_now(),
        )
        db.add(notif)
    db.commit()

    log_audit(
        db=db,
        user_email=normalized_email,
        action="CLIENT_REGISTRATION_SUBMITTED",
        resource_type="registration",
        resource_id=registration.id,
        details=f"Public registration submitted for '{registration.company_name}' ({normalized_email})",
    )

    return registration


def get_registration_by_id(db: Session, reg_id: str) -> Optional[ClientRegistration]:
    """Retrieves a client registration by UUID. Founder access only."""
    return db.query(ClientRegistration).filter(ClientRegistration.id == reg_id).first()


def get_registration_status_by_email(db: Session, email: str) -> Optional[ClientRegistration]:
    """Retrieves the latest registration status for an applicant email."""
    if not email:
        return None
    normalized_email = email.strip().lower()
    return (
        db.query(ClientRegistration)
        .filter(func.lower(func.trim(ClientRegistration.email)) == normalized_email)
        .order_by(desc(ClientRegistration.created_at))
        .first()
    )


def list_registrations(
    db: Session,
    status: Optional[str] = None,
) -> Tuple[List[ClientRegistration], int, int]:
    """Lists client registrations. Founder access only."""
    query = db.query(ClientRegistration)
    if status and status.lower() != "all":
        query = query.filter(ClientRegistration.status == status.lower())
    
    query = query.order_by(desc(ClientRegistration.created_at))
    items = query.all()
    total = len(items)
    pending_count = db.query(ClientRegistration).filter(ClientRegistration.status == "pending").count()
    return items, total, pending_count


def review_registration(
    db: Session,
    reg_id: str,
    action: str,
    reason: Optional[str],
    founder: User,
    assign_employee_id: Optional[str] = None,
) -> ClientRegistration:
    """
    Founder-only review workflow:
    - approve: transactionally creates Client and User(role='client') linked to organization.
    - reject: records rejection reason.
    - request_info: records required information details.
    """
    reg = get_registration_by_id(db, reg_id)
    if not reg:
        raise ValueError("Client registration record not found.")

    now_utc = utc_now()

    if action == "approve":
        # 1. Establish or reuse Client record
        client = (
            db.query(Client)
            .filter(Client.company_name.ilike(reg.company_name.strip()))
            .first()
        )
        if not client:
            client = Client(
                company_name=reg.company_name.strip(),
                primary_contact_name=reg.full_name,
                primary_contact_email=reg.email,
                website=reg.website,
                phone=reg.phone,
                industry=reg.industry,
                notes=f"Scope: {reg.scope_description or 'Standard Assessment'}\nServices: {reg.requested_services or 'General FixOps'}",
                status="active",
                assigned_employee_id=assign_employee_id,
                created_at=now_utc,
                updated_at=now_utc,
            )
            db.add(client)
            db.flush()
        else:
            if assign_employee_id and not client.assigned_employee_id:
                client.assigned_employee_id = assign_employee_id

        # 2. Establish User record for the client
        user = (
            db.query(User)
            .filter(func.lower(func.trim(User.email)) == reg.email.strip().lower())
            .first()
        )
        if user and user.role in ("founder", "admin", "employee"):
            raise ValueError(
                f"Cannot associate registration with existing internal account '{user.email}' (role: {user.role})."
            )

        if not user:
            user = User(
                email=reg.email,
                full_name=reg.full_name,
                role="client",
                client_id=client.id,
                hashed_password=reg.hashed_password,
                is_active=True,
                created_at=now_utc,
                updated_at=now_utc,
            )
            db.add(user)
            db.flush()
        else:
            user.role = "client"
            user.client_id = client.id
            user.is_active = True
            user.updated_at = now_utc

        # 3. Update registration record
        reg.status = "approved"
        reg.client_id = client.id
        reg.user_id = user.id
        reg.reviewed_by = founder.email
        reg.reviewed_at = now_utc
        reg.review_notes = reason
        reg.updated_at = now_utc

        log_audit(
            db=db,
            user_email=founder.email,
            action="APPROVE_CLIENT_REGISTRATION",
            resource_type="registration",
            resource_id=reg.id,
            details=f"Founder approved '{reg.company_name}' ({reg.email}). Client UUID: {client.id}",
        )

    elif action == "reject":
        reg.status = "rejected"
        reg.rejection_reason = reason or "Registration criteria not met."
        reg.reviewed_by = founder.email
        reg.reviewed_at = now_utc
        reg.updated_at = now_utc

        log_audit(
            db=db,
            user_email=founder.email,
            action="REJECT_CLIENT_REGISTRATION",
            resource_type="registration",
            resource_id=reg.id,
            details=f"Founder rejected registration for '{reg.company_name}' ({reg.email}). Reason: {reason}",
        )

    elif action == "request_info":
        reg.status = "needs_information"
        reg.review_notes = reason or "Additional information required regarding authorized scope and domains."
        reg.reviewed_by = founder.email
        reg.reviewed_at = now_utc
        reg.updated_at = now_utc

        log_audit(
            db=db,
            user_email=founder.email,
            action="REQUEST_REGISTRATION_INFO",
            resource_type="registration",
            resource_id=reg.id,
            details=f"Founder requested additional info from '{reg.company_name}' ({reg.email}). Notes: {reason}",
        )
    else:
        raise ValueError(f"Invalid review action '{action}'.")

    db.commit()
    db.refresh(reg)
    return reg
