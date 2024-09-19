from django.db.models.signals import pre_save, post_delete
from django.dispatch import receiver
from .models import CustomUser

@receiver(pre_save, sender=CustomUser)
def delete_old_avatar_on_update(sender, instance, **kwargs):
    """
    Deletes the old avatar file when the user uploads a new one.
    This is triggered before the user instance is saved. 
    """
    if not instance.pk:
        # If the instance has no primary key yet, it is being created so do nothing
        return
    
    try:
        old_avatar = CustomUser.objects.get(pk=instance.pk).avatar
    except CustomUser.DoesNotExist:
        return

    # Check if the avatar is being changed and if tthe old avatar exists in the filesystem
    if old_avatar and old_avatar != instance.avatar and old_avatar.name:
        old_avatar.delete(save=False) # Delete the old file

@receiver(post_delete, sender=CustomUser)
def delete_avatar_on_user_delete(sender, instance, **kwargs):
    """
    Deletes the avatar file from the filesystem when the CustomUser object is deleted
    """
    if instance.avatar and instance.avatar.name:
        instance.avatar.delete(save=False)