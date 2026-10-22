"""
Autonomous background scheduler runner for Remediation Follow-up Reminders.
Can be executed as a local cron job, Render Cron Job, or GitHub Actions step:
    python -m app.tasks.run_remediation_scheduler
"""

import sys
import logging
from app.core.config import settings
from app.db.session import Base, SessionLocal, engine
from app.services.automation_engine import run_remediation_followup_reminders

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [scheduler]: %(message)s",
)
logger = logging.getLogger("remediation_scheduler")


def main() -> int:
    logger.info("Initializing Remediation Follow-up Reminder background job...")
    if settings.ENVIRONMENT != "production":
        Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        result = run_remediation_followup_reminders(
            db=db,
            reminder_window_days=3,
            operator_email="scheduled_daemon@lazynerds.com",
        )
        logger.info(
            f"Remediation job completed successfully: {result['status']}. "
            f"Checked: {result['findings_checked']}, Sent: {result['reminders_sent']}, "
            f"Duplicates Avoided: {result['duplicates_skipped']}, Errors: {result['errors']}."
        )
        return 0
    except Exception as e:
        logger.error(f"Fatal error running remediation scheduler: {e}", exc_info=True)
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
