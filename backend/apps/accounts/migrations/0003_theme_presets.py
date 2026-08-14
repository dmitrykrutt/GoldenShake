# Migration to update theme_color choices to 8 named presets

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_alter_user_email_optional"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="theme_color",
            field=models.CharField(
                choices=[
                    ("midnight", "Midnight"),
                    ("golden", "Golden Hour"),
                    ("emerald", "Emerald"),
                    ("crimson", "Crimson"),
                    ("ocean", "Ocean"),
                    ("sakura", "Sakura"),
                    ("graphite", "Graphite"),
                    ("aurora", "Aurora"),
                ],
                default="midnight",
                max_length=16,
            ),
        ),
    ]
