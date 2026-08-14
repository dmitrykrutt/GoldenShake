# Generated migration for FiatBalance, FiatTransaction, DepositInvoice, WithdrawalRequest

import django.db.models.deletion
import django.utils.timezone
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("coins", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="FiatBalance",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("currency", models.CharField(max_length=10)),
                ("amount", models.DecimalField(decimal_places=2, default=0, max_digits=18)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="fiat_balances",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"db_table": "coins_fiat_balance", "ordering": ("user", "currency"), "unique_together": {("user", "currency")}},
        ),
        migrations.CreateModel(
            name="FiatTransaction",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("currency", models.CharField(max_length=10)),
                ("amount", models.DecimalField(decimal_places=2, max_digits=18)),
                ("tx_type", models.CharField(choices=[("deposit", "Deposit"), ("withdrawal", "Withdrawal"), ("deal_income", "Deal Income"), ("deal_refund", "Deal Refund")], max_length=20)),
                ("description", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="fiat_transactions",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"db_table": "coins_fiat_transaction", "ordering": ("-created_at",)},
        ),
        migrations.CreateModel(
            name="DepositInvoice",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("cryptopay_invoice_id", models.CharField(blank=True, db_index=True, default="", max_length=64)),
                ("pay_url", models.URLField(blank=True, default="")),
                ("amount", models.DecimalField(decimal_places=2, max_digits=18)),
                ("currency", models.CharField(max_length=10)),
                ("status", models.CharField(choices=[("pending", "Pending"), ("paid", "Paid"), ("expired", "Expired")], default="pending", max_length=16)),
                ("raw_payload", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="deposit_invoices",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"db_table": "coins_deposit_invoice", "ordering": ("-created_at",)},
        ),
        migrations.CreateModel(
            name="WithdrawalRequest",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("currency", models.CharField(max_length=10)),
                ("amount", models.DecimalField(decimal_places=2, max_digits=18)),
                ("wallet_address", models.CharField(max_length=200)),
                ("status", models.CharField(choices=[("pending", "Pending"), ("completed", "Completed"), ("rejected", "Rejected")], default="pending", max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="withdrawal_requests",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"db_table": "coins_withdrawal_request", "ordering": ("-created_at",)},
        ),
    ]
