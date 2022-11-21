import json
import logging
import os
import tqdm
import boto3
import shutil
from botocore.exceptions import ClientError
from django.conf import settings
from django.core.management.base import BaseCommand
from documents.models import Document

logger = logging.getLogger("paperless.management.google_drive_share")


class Command(BaseCommand):
    help = """
        Copy documents to google drive
    """.replace(
        "    ",
        "",
    )

    def handle(self, *args, **options):
        # Detect if we support color
        color = self.style.ERROR("test") != "test"

        # get queue folders
        request_path = settings.REQUEST_DIR
        processed_path = settings.PROCESSED_DIR

        # if processed does not exist, create it.
        if not os.path.exists(processed_path):
            os.makedirs(processed_path)

        # get list of files
        dir_list = os.listdir(request_path)

        for file in tqdm.tqdm(dir_list):
            with open(f"{request_path}/{file}", 'r') as f:
                contents = json.loads(f.read())

            document = Document.objects.get(id=contents['id'])

            session = boto3.Session(profile_name='paperless')
            s3_client = session.client('s3')

            upload_file = f"{settings.ORIGINALS_DIR}/{document.filename}"
            new_file_name = f"{contents['folder']}--++--{document.original_filename}"
            if os.path.exists(upload_file):
                try:
                    s3_client.upload_file(
                        upload_file,
                        settings.AWS_S3_GOOGLE_DRIVE_DIR,
                        new_file_name
                    )

                    shutil.copyfile(f"{request_path}/{file}",
                                    f"{processed_path}/{file}")

                    os.remove(f"{request_path}/{file}")
                except ClientError as e:
                    logging.error(
                        f"Failed to upload failed to S3 bucket, error{e}")
            else:
                logger.warning(f"FileDoesNotExist: {upload_file}")


