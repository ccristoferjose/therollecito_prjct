#!/usr/bin/env bash
# Generates a cryptographically secure 64-byte random string for JWT_SECRET

SECRET=$(openssl rand -base64 64 | tr -d '\n')

echo ""
echo "Generated JWT_SECRET:"
echo ""
echo "  $SECRET"
echo ""
echo "Add this to your backend/.env file:"
echo ""
echo "  JWT_SECRET=$SECRET"
echo ""
