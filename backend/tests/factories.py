"""factory_boy factories used across the test-suite."""
import factory
from django.contrib.auth import get_user_model
from faker import Faker

fake = Faker()
User = get_user_model()

ALLOWED_DOMAIN = "gmail.com"


class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User
        skip_postgeneration_save = True

    username = factory.Sequence(lambda n: f"user_{n}")
    email = factory.Sequence(lambda n: f"user_{n}@{ALLOWED_DOMAIN}")
    is_email_confirmed = True
    is_18_confirmed = True
    tos_confirmed = True

    @factory.post_generation
    def password(self, create, extracted, **kwargs):
        raw = extracted or "GoldenShake!2024"
        self.set_password(raw)
        if create:
            self.save(update_fields=["password"])


class ChatRoomFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = "chat.ChatRoom"

    title = factory.Sequence(lambda n: f"room {n}")


class PostFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = "posts.Post"

    author = factory.SubFactory(UserFactory)
    content = factory.LazyFunction(lambda: fake.sentence())


class GarantDealFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = "garant.GarantDeal"

    creator = factory.SubFactory(UserFactory)
    title = factory.Sequence(lambda n: f"Deal {n}")
    description = factory.LazyFunction(lambda: fake.paragraph())
    price_crypto = "100.00000000"
    crypto_currency = "USDT"
