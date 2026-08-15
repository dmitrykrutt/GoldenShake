from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("coins", "0002_fiat_models"),
    ]

    operations = [
        migrations.AddField(
            model_name="withdrawalrequest",
            name="network",
            field=models.CharField(default="TON", max_length=20),
        ),
    ]
