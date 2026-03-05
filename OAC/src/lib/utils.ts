import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a number as Zambia Kwacha currency.
 * Handles null/undefined/NaN values gracefully and always returns a formatted string.
 * @param amount - The amount to format (can be number, string, null, or undefined)
 * @returns Formatted currency string (e.g., "ZMW 1,234.56")
 */
export function formatCurrency(amount: number | string | null | undefined): string {
  // Handle null, undefined, or empty string
  if (amount === null || amount === undefined || amount === '') {
    return 'ZMW 0.00';
  }
  
  // Convert to number
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  // Handle NaN or invalid numbers
  if (isNaN(numAmount) || !isFinite(numAmount)) {
    return 'ZMW 0.00';
  }
  
  // Try using Intl.NumberFormat with fallback
  try {
    const formatter = new Intl.NumberFormat("en-ZM", { 
      style: "currency", 
      currency: "ZMW",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    const formatted = formatter.format(numAmount);
    // If formatter returns invalid result, use fallback
    if (!formatted || formatted === 'NaN' || formatted.includes('NaN')) {
      throw new Error('Formatter returned invalid result');
    }
    return formatted;
  } catch (error) {
    // Fallback formatting if Intl.NumberFormat fails
    const fixedAmount = numAmount.toFixed(2);
    const parts = fixedAmount.split('.');
    const integerPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `ZMW ${integerPart}.${parts[1] || '00'}`;
  }
}

/**
 * Generates a unique user ID consisting of 4 digits and 1 special character.
 * Format: XXXX@ where XXXX are digits and @ is a special character.
 * Special characters used: !@#$%^&*()_+-=[]{}|;:,.<>?
 */
export function generateUniqueUserId(): string {
  // Generate 4 random digits (0000-9999)
  const digits = Math.floor(1000 + Math.random() * 9000).toString();
  
  // Special characters pool
  const specialChars = "!@#$%^&*()_+-=[]{}|;:,.<>?";
  const specialChar = specialChars[Math.floor(Math.random() * specialChars.length)];
  
  return `${digits}${specialChar}`;
}

/**
 * Generates a unique user ID and ensures it doesn't exist in the database.
 * Optimized for speed - reduced max attempts and faster query.
 * @param db - The database client
 * @param maxAttempts - Maximum number of attempts to generate a unique ID (default: 20)
 * @returns A unique user ID
 */
export async function generateAndVerifyUniqueUserId(
  db: any,
  maxAttempts: number = 30
): Promise<string> {
  let lastError: any = null;
  let columnExists = true;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const userId = generateUniqueUserId();
      
      // Check if this ID already exists in the database
      const { data, error } = await db
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
  
  // If column doesn't exist, provide helpful error message
  if (!columnExists) {
    const sqlInstructions = `
═══════════════════════════════════════════════════════════════
❌ DATABASE COLUMN MISSING: unique_id
═══════════════════════════════════════════════════════════════

The 'unique_id' column does not exist in the 'users' table.

To fix this, run this SQL in your Supabase SQL Editor:

ALTER TABLE users ADD COLUMN IF NOT EXISTS unique_id TEXT UNIQUE;

Or if you want to make it nullable initially:

ALTER TABLE users ADD COLUMN IF NOT EXISTS unique_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_unique_id_idx ON users(unique_id) WHERE unique_id IS NOT NULL;

After running the SQL, refresh the page and try again.
═══════════════════════════════════════════════════════════════
`;
    console.error(sqlInstructions);
    throw new Error(
      "Database column 'unique_id' does not exist. Please add it to the users table. " +
      "Check the browser console for SQL instructions."
    );
  }
  
  // If we exhausted all attempts, throw error with details
  const errorMsg = lastError 
    ? `Unable to generate unique ID after ${maxAttempts} attempts. Last error: ${lastError.message || lastError}`
    : `Unable to generate unique ID after ${maxAttempts} attempts. All IDs appear to be taken.`;
  throw new Error(errorMsg);
}

/**
 * Generates unique IDs for all existing users who don't have one.
 * This function should be run once to backfill unique_ids for existing users.
 * @param db - The database client
 * @returns Object with success count and any errors
 */
export async function generateUniqueIdsForExistingUsers(db: any): Promise<{ success: number; errors: number; details: string[] }> {
  const results = { success: 0, errors: 0, details: [] };
  
  try {
    // Fetch all users without unique_id - try multiple query patterns
    let users: any[] = [];
    let fetchError: any = null;
    
    // Try first query pattern
    const { data: data1, error: error1 } = await db
      .from("users")
      .select("id, name, email, unique_id")
      .is("unique_id", null);
    
    if (!error1 && data1) {
      users = data1.filter((u: any) => !u.unique_id);
    } else {
      fetchError = error1;
    }
    
    // If first query didn't work or returned empty, try alternative
    if (users.length === 0 && !fetchError) {
      const { data: data2, error: error2 } = await db
        .from("users")
        .select("id, name, email, unique_id");
      
      if (!error2 && data2) {
        users = data2.filter((u: any) => !u.unique_id || u.unique_id === null || u.unique_id === "");
      } else if (error2) {
        fetchError = error2;
      }
    }
    
    if (fetchError) {
      results.errors++;
      results.details.push(`Error fetching users: ${fetchError.message}`);
      return results;
    }
    
    if (!users || users.length === 0) {
      results.details.push("No users found without unique_id - all users already have IDs!");
      return results;
    }
    
    results.details.push(`Found ${users.length} users without unique_id. Generating IDs...`);
    
    // Generate and assign unique IDs for each user (with progress updates)
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      try {
        const uniqueId = await generateAndVerifyUniqueUserId(db, 30); // Increase attempts for batch
        const { error: updateError } = await db
          .from("users")
          .update({ unique_id: uniqueId })
          .eq("id", user.id);
        
        if (updateError) {
          results.errors++;
          results.details.push(`Failed to update user ${user.email || user.name || user.id}: ${updateError.message}`);
        } else {
          results.success++;
          // Only log every 10th user to avoid console spam
          if (i % 10 === 0 || i === users.length - 1) {
            results.details.push(`Progress: ${i + 1}/${users.length} - Generated unique_id ${uniqueId} for ${user.email || user.name || user.id}`);
          }
        }
      } catch (err: any) {
        results.errors++;
        results.details.push(`Error generating ID for user ${user.email || user.name || user.id}: ${err.message}`);
      }
    }
    
    results.details.push(`\n=== COMPLETED ===`);
    results.details.push(`Total users processed: ${users.length}`);
    results.details.push(`Successfully generated: ${results.success}`);
    results.details.push(`Errors: ${results.errors}`);
    return results;
  } catch (err: any) {
    results.errors++;
    results.details.push(`Fatal error: ${err.message}`);
    return results;
  }
}
