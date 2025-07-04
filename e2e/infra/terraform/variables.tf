variable "fpjs_shared_secret" {
  // https://dev.fingerprint.com/docs/cloudfront-proxy-integration-v2#step-1-issue-a-proxy-secret
  description = "The proxy secret for the Fingerprint proxy integration"
  type        = string
}

variable "fpjs_agent_download_path" {
  // https://dev.fingerprint.com/docs/cloudfront-proxy-integration-v2#step-2-create-path-variables
  description = "The Fingerprint agent download will be proxied through this path segment"
  type        = string
  default     = "agent"
}

variable "fpjs_get_result_path" {
  description = "The Fingerprint identification request will be proxied through this path segment"
  type        = string
  default     = "result"
}

variable "fpjs_behavior_path" {
  type    = string
  default = "fpjs"
}

variable "run_tests" {
  type        = bool
  default     = true
  description = "Whether to run E2E tests are part of `terraform apply`."
}

variable "run_mock_warden_tests" {
  type        = bool
  default     = false
  description = "Whether to run mock-warden tests as part of `terraform apply`."
}

variable "mock_warden_url" {
  type = string
  default = null
  description = "URL of the mock-warden. Relevant only if `run_mock_warden_tests` is set to true."
}

variable "fpjs_origin_name" {
  type    = string
  default = "fpcdn.io"
}

variable "fpjs_origin_id" {
  default     = "fpcdn.io"
  type        = string
  description = "Fingerprint Pro CDN origin domain id"
}

variable "fpjs_origin_request_policy_id" {
  default = "216adef6-5c7f-47e4-b989-5492eafa07d3" # Default AllViewer policy
  type        = string
  description = "Fingerprint Pro CDN origin request policy id"
}