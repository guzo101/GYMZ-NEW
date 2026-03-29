import { supabase } from '../services/supabase';

/**
 * Generates a unique user ID consisting of 4 digits and 1 special character.
 * Format: XXXX@ where XXXX are digits and @ is a special character.
 * Special characters used: !@#$%^&*()_+-=[]{}|;:,.<>?
 */
export function generateUniqueUserId(): string {
  // Generate 4 random digits (1000-9999)
  const digits = Math.floor(1000 + Math.random() * 9000).toString();

  // Special characters pool
  const specialChars = "!@#$%^&*()_+-=[]{}|;:,.<>?";
  const specialChar = specialChars[Math.floor(Math.random() * specialChars.length)];

  return `${digits}${specialChar}`;
}

/**
 * Generate a unique thread_id for a user
 * Thread_id is permanent and never changes
 * Uses a UUID-like format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 */
export async function generateThreadId(): Promise<string> {
  // Generate UUID v4-like string
  const chars = '0123456789abcdef';
  const segments = [8, 4, 4, 4, 12];

  return segments.map(len => {
    let segment = '';
    for (let i = 0; i < len; i++) {
      segment += chars[Math.floor(Math.random() * chars.length)];
    }
    return segment;
  }).join('-');
}

/**
 * Get or create thread_id for a user
 * Ensures every user has a permanent thread_id
 */
export async function getOrCreateThreadId(userId: string): Promise<string> {
  try {
    // First check if user has thread_id in users table (faster lookup)
    const { data: userData, error: userError } = await (supabase as any)
      .from("users")
      .select("thread_id")
      .eq("id", userId)
      .maybeSingle();

    if (!userError && userData?.thread_id) {
      return userData.thread_id;
    }

    // If not in users table, check conversations table (fallback)
    const { data: lastConversation, error: fetchError } = await (supabase as any)
      .from("conversations")
      .select("thread_id")
      .eq("user_id", userId)
      .order("timestamp", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError && fetchError.code !== "PGRST116") {
      console.warn("Error fetching thread_id from conversations:", fetchError);
    }

    // If user has a thread_id from previous conversations, return it
    if (lastConversation?.thread_id) {
      // Optionally update users table for faster future lookups (non-blocking)
      (supabase as any)
        .from("users")
        .update({ thread_id: lastConversation.thread_id })
        .eq("id", userId);

      return lastConversation.thread_id;
    }

    // Generate new thread_id
    const newThreadId = await generateThreadId();

    // Optionally store in users table for faster future lookups (non-blocking)
    (supabase as any)
      .from("users")
      .update({ thread_id: newThreadId })
      .eq("id", userId);

    return newThreadId;
  } catch (error) {
    console.error("Error in getOrCreateThreadId:", error);
    // Return a generated thread_id even on error to prevent blocking
    return await generateThreadId();
  }
}

/**
 * Generates a unique user ID and ensures it doesn't exist in the database.
 * @param maxAttempts - Maximum number of attempts to generate a unique ID (default: 30)
 * @returns A unique user ID
 */
export async function generateAndVerifyUniqueUserId(
  maxAttempts: number = 30
): Promise<string> {
  let lastError: any = null;
  let columnExists = true;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const userId = generateUniqueUserId();

      // Check if this ID already exists in the database
      const { data, error } = await (supabase as any)
        .from("users")
        .select("unique_id")
        .eq("unique_id", userId)
        .limit(1)
        .maybeSingle();

      // Check if error is due to missing column
      if (error && (error.message?.includes('does not exist') || error.message?.includes('column') || error.code === '42703')) {
        columnExists = false;
        lastError = error;
        break; // Exit loop - column doesn't exist
      }

      // If we got data, the ID exists - try again
      if (data) {
        continue;
      }

      // If there's an error, check if it's a "not found" error (which is good)
      // PGRST116 = no rows returned (which means ID is unique - this is what we want!)
      if (error) {
        // PGRST116 means no rows found - ID is unique!
        if (error.code === 'PGRST116' || error.message?.includes('No rows')) {
          return userId;
        }
        // Other errors - log and continue
        lastError = error;
        if (attempt < 3) {
          console.warn(`Attempt ${attempt + 1}: Error checking unique ID:`, error.message || error);
        }
        continue;
      }

      // No error and no data means ID is unique
      if (!error && !data) {
        return userId;
      }
    } catch (err: any) {
      // Check if error is due to missing column
      if (err.message?.includes('does not exist') || err.message?.includes('column') || err.code === '42703') {
        columnExists = false;
        lastError = err;
        break;
      }
      lastError = err;
      if (attempt < 3) {
        console.warn(`Attempt ${attempt + 1}: Exception during ID generation:`, err.message || err);
      }
      // Continue to next attempt
    }
  }

  // If we exhausted all attempts, throw an error
  throw new Error(
    `Failed to generate unique user ID after ${maxAttempts} attempts. ${lastError ? `Last error: ${lastError.message || lastError}` : ''}`
  );
}

