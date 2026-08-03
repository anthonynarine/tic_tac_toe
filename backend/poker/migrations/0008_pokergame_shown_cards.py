from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("poker", "0007_pokertournament_pokertournamentregistration"),
    ]

    operations = [
        migrations.AddField(
            model_name="pokergame",
            name="shown_cards",
            field=models.JSONField(default=list),
        ),
    ]
