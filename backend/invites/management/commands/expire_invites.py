# Filename: invites/management/commands/expire_invites.py

from __future__ import annotations

from typing import Any

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from invites.models import GameInvite, GameInviteStatus


class Command(BaseCommand):
    """
    Expire stale GameInvite rows that are still PENDING but have passed expires_at.

    Usage:
        python manage.py expire_invites --dry-run
        python manage.py expire_invites
        python manage.py expire_invites --limit 500

    Notes:
    - This is a lightweight cleanup job intended for cron / Heroku Scheduler.
    - It is NOT required for correctness because access guards enforce expiry,
      but it keeps DB state truthful and reduces noise in inbox queries.
    """

    help = "Expire PENDING invites whose expires_at is in the past."

    def add_arguments(self, parser) -> None:
        # Step 1: Optional dry-run
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Print what would be expired without writing changes.",
        )

        # Step 2: Optional limit (safety valve)
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Max number of invites to expire in this run (0 = no limit).",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        # Step 1: Read args
        dry_run: bool = bool(options.get("dry_run"))
        limit: int = int(options.get("limit") or 0)

        now = timezone.now()

        # Step 2: Find stale pending invites
        qs = GameInvite.objects.filter(
            status=GameInviteStatus.PENDING,
            expires_at__lt=now,
        ).order_by("expires_at")

        if limit > 0:
            qs = qs[:limit]

        stale_ids = list(qs.values_list("id", flat=True))
        count = len(stale_ids)

        if count == 0:
            self.stdout.write(self.style.SUCCESS("✅ No stale invites found."))
            return

        # Step 3: Dry run output
        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f"DRY RUN: Would expire {count} invite(s): {stale_ids[:25]}"
                    + (" ..." if count > 25 else "")
                )
            )
            return

        # Step 4: Expire in one atomic update
        with transaction.atomic():
            updated = GameInvite.objects.filter(id__in=stale_ids).update(
                status=GameInviteStatus.EXPIRED,
                responded_at=now,
            )

        # Step 5: Final output
        self.stdout.write(
            self.style.SUCCESS(f"✅ Expired {updated} invite(s) (now={now.isoformat()}).")
        )
