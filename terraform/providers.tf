terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Uncomment and configure for remote state (recommended for teams)
  # backend "s3" {
  #   bucket         = "devsecops-terraform-state"
  #   key            = "eks/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "devsecops-tf-lock"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "devsecops"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}