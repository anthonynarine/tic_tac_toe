from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("poker", "0008_pokergame_shown_cards"),
    ]

    operations = [
        migrations.AddField(
            model_name="pokergame",
            name="last_hand_result",
            field=models.JSONField(blank=True, null=True),
        ),
    ]
