import argparse
import sys
from app.db.session import SessionLocal, Base, engine
from app.schemas.auth import UserCreate
from app.schemas.client import ClientCreate
from app.services.auth_service import create_user, get_user_by_email
from app.services.client_service import create_client


def init_db():
    Base.metadata.create_all(bind=engine)
    print("Database tables created.")


def create_user_cmd(email: str, password: str, full_name: str, role: str = "founder"):
    db = SessionLocal()
    existing = get_user_by_email(db, email)
    if existing:
        print(f"User with email '{email}' already exists.")
        sys.exit(1)
    
    user = create_user(
        db,
        UserCreate(
            email=email,
            password=password,
            full_name=full_name,
            role=role,
        )
    )
    db.close()
    print(f"Authorized user created successfully: {user.email} (ID: {user.id})")


def seed_demo_cmd():
    """Seeds explicitly labeled demonstration client data for development."""
    db = SessionLocal()
    demo_clients = [
        ClientCreate(
            company_name="Apex Global Security (DEMO)",
            primary_contact_name="Elena Rostova",
            primary_contact_email="elena.rostova@apex-sec.demo",
            website="https://apex-sec.demo",
            phone="+1-555-0199",
            industry="Fintech & Banking",
            notes="DEMO DATA: Initial security posture assessment and quarterly external penetration test scope.",
        ),
        ClientCreate(
            company_name="Helios Cloud Infrastructure (DEMO)",
            primary_contact_name="Marcus Vance",
            primary_contact_email="m.vance@helios-cloud.demo",
            website="https://helios-cloud.demo",
            phone="+44-20-7946-0912",
            industry="Cloud Services",
            notes="DEMO DATA: Multi-tenant Kubernetes cluster review and API gateway authorization check.",
        ),
        ClientCreate(
            company_name="Veritas Health Systems (DEMO)",
            primary_contact_name="Dr. Aris Thorne",
            primary_contact_email="athorne@veritas-health.demo",
            website="https://veritas-health.demo",
            phone="+1-555-0821",
            industry="Healthcare Technology",
            notes="DEMO DATA: HIPAA compliance boundary validation and medical IoT perimeter review.",
        ),
    ]

    for item in demo_clients:
        create_client(db, item)
    db.close()
    print("Successfully seeded 3 demonstration clients (labeled DEMO).")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="FixOps CLI management utility")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # init-db
    subparsers.add_parser("init-db", help="Initialize database schema tables")

    # create-user
    user_parser = subparsers.add_parser("create-user", help="Create an authorized staff account")
    user_parser.add_argument("--email", required=True, help="User email address")
    user_parser.add_argument("--password", required=True, help="Password (min 8 chars)")
    user_parser.add_argument("--name", required=True, help="Full name")
    user_parser.add_argument("--role", default="founder", help="Role (founder, consultant, admin)")

    # seed-demo
    subparsers.add_parser("seed-demo", help="Seed explicit demonstration client records")

    args = parser.parse_args()

    if args.command == "init-db":
        init_db()
    elif args.command == "create-user":
        create_user_cmd(args.email, args.password, args.name, args.role)
    elif args.command == "seed-demo":
        seed_demo_cmd()
