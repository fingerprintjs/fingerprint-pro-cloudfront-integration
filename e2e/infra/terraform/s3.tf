resource "random_id" "bucket_id" {
  byte_length = 6
}

resource "aws_s3_bucket" "website_bucket" {
  bucket = "website-bucket-${random_id.bucket_id.dec}"

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

resource "aws_s3_bucket_public_access_block" "website_bucket_access_block" {
  bucket              = aws_s3_bucket.website_bucket.id
  block_public_acls   = false
  block_public_policy = false
}

resource "aws_s3_bucket_policy" "website_bucket_policy" {
  bucket = aws_s3_bucket.website_bucket.id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect    = "Allow",
        Principal = "*",
        Action    = ["s3:GetObject"],
        Resource  = ["${aws_s3_bucket.website_bucket.arn}/*"]
      }
    ]
  })
}




