resource "random_id" "integration_id" {
  byte_length = 6
}

locals {
  integration_id = random_id.integration_id.hex
}
