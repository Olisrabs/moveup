-- 1. Remove ai_score from room_members if it exists
ALTER TABLE public.room_members 
  DROP COLUMN IF EXISTS ai_score;

-- 2. Remove any AI grading columns from the tasks table if they exist
ALTER TABLE public.tasks 
  DROP COLUMN IF EXISTS ai_score,
  DROP COLUMN IF EXISTS ai_reasoning,
  DROP COLUMN IF EXISTS ai_graded;

-- 3. Remove any AI grading columns from the proofs table if they exist
ALTER TABLE public.proofs 
  DROP COLUMN IF EXISTS ai_score,
  DROP COLUMN IF EXISTS ai_reasoning,
  DROP COLUMN IF EXISTS ai_graded;

-- 4. Drop any potential custom AI evaluation/grading tables if they were created
DROP TABLE IF EXISTS public.ai_grades CASCADE;
DROP TABLE IF EXISTS public.ai_evaluations CASCADE;
DROP TABLE IF EXISTS public.ai_logs CASCADE;
DROP TABLE IF EXISTS public.gemini_logs CASCADE;

-- 5. Drop any database functions or triggers related to AI grading
DROP FUNCTION IF EXISTS public.grade_task_with_ai CASCADE;
DROP FUNCTION IF EXISTS public.calculate_ai_score CASCADE;
DROP FUNCTION IF EXISTS public.trigger_ai_grading CASCADE;
DROP FUNCTION IF EXISTS public.handle_ai_grading CASCADE;
