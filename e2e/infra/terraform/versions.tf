terraform {
  required_version = "~> 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "4.59.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.7.1"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "2.7.0"
    }
    local = {
      source  = "hashicorp/local"
      version = "2.5.2"
    }
    null = {
      source  = "hashicorp/null"
      version = "3.2.3"
    }
  }
}
