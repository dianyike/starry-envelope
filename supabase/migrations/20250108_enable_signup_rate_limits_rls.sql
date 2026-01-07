-- Enable RLS on signup_rate_limits table
-- This table is only accessed by check_signup_rate_limit RPC (SECURITY DEFINER)
-- No policies needed as direct access should be blocked

ALTER TABLE public.signup_rate_limits ENABLE ROW LEVEL SECURITY;

-- Add comment for documentation
COMMENT ON TABLE public.signup_rate_limits IS 'IP rate limit bucket for signup. Access via check_signup_rate_limit RPC only.';
