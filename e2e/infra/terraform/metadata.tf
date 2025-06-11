module "test_metadata" {
  source = "git@github.com:fingerprintjs/fp-infra-module-metadata.git//modules/metadata?ref=v0.6.0"

  env  = "${var.env}-${var.tier}"
  tier = var.tier

  tags = local.tags
}

locals {
  tags = merge(
    {
      "WORKSPACE" = var.workspace
      "TERRAFORM" = "true"
      "ENV"       = var.env
    },
    var.tags,
  )
}

variable "region" {
  description = "Region"
  type        = string
}

variable "tier" {
  description = "Service tier."
  type        = string
}

variable "aws_account" {
  description = "aws_account"
  type        = string
}

variable "company" {
  description = "company"
  type        = string
}

variable "workspace" {
  description = "avoids the name special space by using workspace to denote tagging"
  type        = string
}

variable "env" {
  description = "Service environment."
  type        = string
}

variable "platform" {
  description = "Service platform."
  type        = string
}

variable "tags" {
  description = "A map of tags to use on all resources"
  type        = map(string)
  default     = {}
}

output "metadata" {
  value = module.test_metadata.metadata
}

output "runtime" {
  value = module.test_metadata.runtime
}

output "git_branch" {
  value = module.test_metadata.git_branch
}

output "git_sha" {
  value = module.test_metadata.git_sha
}

output "repo_version" {
  value = module.test_metadata.repo_version
}

output "repo_name" {
  value = module.test_metadata.repo_name
}

