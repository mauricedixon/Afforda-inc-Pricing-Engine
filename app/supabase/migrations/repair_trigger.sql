
-- Database Repair Migration
-- This script drops any triggers or functions that might be referencing the non-existent 'labor_trade' column.

-- 1. Drop the trigger if it exists (safely)
DROP TRIGGER IF EXISTS project_line_items_labor_trade_trigger ON public.project_line_items;

-- 2. Drop the function if it exists (safely)
DROP FUNCTION IF EXISTS public.update_labor_trade_column();

-- 3. Refresh the schema cache
NOTIFY pgrst, 'reload schema';

