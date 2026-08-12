from django.db import migrations, models

import apps.accounts.validators


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="email",
            field=models.EmailField(
                blank=True,
                max_length=254,
                null=True,
                unique=True,
                validators=[apps.accounts.validators.validate_email_domain],
            ),
        ),
    ]
