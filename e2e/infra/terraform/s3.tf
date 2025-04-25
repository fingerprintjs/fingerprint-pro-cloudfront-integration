resource "random_id" "bucket_id" {
  byte_length = 6
}

resource "aws_s3_bucket" "website_bucket" {
  bucket = "test-website-bucket-${random_id.bucket_id.dec}"

  tags = {
    Name = "website-bucket"
  }
}

resource "aws_s3_bucket_website_configuration" "website_endpoint" {
  bucket = aws_s3_bucket.website_bucket.id

  index_document {
    suffix = "index.html"
  }
}





