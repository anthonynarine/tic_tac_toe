# Generated by Django 5.1 on 2025-05-31 19:50

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("chat", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Conversation",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "created_at",
                    models.DateTimeField(
                        auto_now_add=True,
                        help_text="Timestamp when the conversation was first created. ",
                    ),
                ),
                (
                    "user1",
                    models.ForeignKey(
                        help_text="One of the users in the conversation",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="conversation_user1",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "user2",
                    models.ForeignKey(
                        help_text="The other user in the conversation",
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="conversation_user2",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Conversation",
                "verbose_name_plural": "Conversations",
                "unique_together": {("user1", "user2")},
            },
        ),
        migrations.AddField(
            model_name="directmessage",
            name="conversation",
            field=models.ForeignKey(
                default=None,
                help_text="The conversation this message belongs to",
                on_delete=django.db.models.deletion.CASCADE,
                related_name="messages",
                to="chat.conversation",
            ),
            preserve_default=False,
        ),
    ]
