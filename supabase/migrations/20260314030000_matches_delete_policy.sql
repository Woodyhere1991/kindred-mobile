-- Allow users to delete their own declined/dismissed matches
CREATE POLICY "Users can delete own declined matches" ON public.matches FOR DELETE
  USING (
    (giver_id = auth.uid() OR receiver_id = auth.uid())
    AND status IN ('declined', 'dismissed')
  );
