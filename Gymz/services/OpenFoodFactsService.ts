
export interface OpenFoodFactsProduct {
    status: number;
    product?: {
        product_name_en?: string;
        product_name?: string;
        brands?: string;
        quantity?: string;
        image_url?: string;
        nutriments?: {
            'energy-kcal_100g'?: number;
            proteins_100g?: number;
            carbohydrates_100g?: number;
            fat_100g?: number;
            'energy-kcal_serving'?: number;
            proteins_serving?: number;
            carbohydrates_serving?: number;
            fat_serving?: number;
        };
        serving_size?: string;
        serving_quantity?: number;
    };
}

export interface ScannedFoodItem {
    name: string;
    brand?: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    servingSize?: string;
    imageUrl?: string;
}

const API_BASE_URL = 'https://world.openfoodfacts.org/api/v0/product/';

export const OpenFoodFactsService = {
    /**
     * Fetches product information from OpenFoodFacts by barcode.
     * @param barcode The scanned barcode string.
     * @returns A promise that resolves to a ScannedFoodItem or null if not found.
     */
    async getProductByBarcode(barcode: string): Promise<ScannedFoodItem | null> {
        try {
            const response = await fetch(`${API_BASE_URL}${barcode}.json`);
            const data: OpenFoodFactsProduct = await response.json();

            if (data.status !== 1 || !data.product) {
                console.log(`Product not found for barcode: ${barcode}`);
                return null; // Product not found
            }

            const product = data.product;
            const nutriments = product.nutriments;

            // Prioritize English name, fallback to generic name
            const name = product.product_name_en || product.product_name || 'Unknown Food';

            // We prefer serving size data if available, otherwise 100g
            // Note: OpenFoodFacts data can be messy. 
            // Sometimes _serving fields are present, sometimes only _100g.

            // Let's default to 100g as a baseline if serving info is missing, 
            // but if serving info is there, we might want to return that OR return 100g and let the UI handle the multiplier.
            // For simplicity in this first pass, let's grab 100g values as the "base" unit.
            // The calling UI can then ask "How many grams?" (defaulting to 100g).

            const calories = nutriments?.['energy-kcal_100g'] || 0;
            const protein = nutriments?.proteins_100g || 0;
            const carbs = nutriments?.carbohydrates_100g || 0;
            const fat = nutriments?.fat_100g || 0;

            return {
                name,
                brand: product.brands,
                calories,
                protein,
                carbs,
                fat,
                servingSize: product.serving_size || '100g', // informative
                imageUrl: product.image_url
            };

        } catch (error) {
            console.error('Error fetching data from OpenFoodFacts:', error);
            return null;
        }
    }
};
