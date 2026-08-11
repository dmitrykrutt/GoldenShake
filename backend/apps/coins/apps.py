from django.apps import AppConfig


class CoinsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.coins"
    label = "coins"
    verbose_name = "Handshake Coins"

    def ready(self):
        from apps.coins import signals  # noqa: F401
