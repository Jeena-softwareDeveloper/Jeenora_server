const formatWearProductForClient = (p) => {
    // Gracefully handle missing or malformed data
    if (!p) return null;

    // Support both mongoose documents and lean objects
    const product = p.toObject ? p.toObject() : p;
    const variants = product.variants || [];

    let bestPrice = variants?.[0]?.listingPrice || product.price || 0;
    if (product.isBulkOnly && variants.length > 0) {
        let lowest = Infinity;
        variants.forEach(v => {
            (v.priceTiers || []).forEach(t => {
                if (t.price < lowest) lowest = t.price;
            });
        });
        if (lowest !== Infinity) bestPrice = lowest;
    }

    // ALWAYS PRIORITIZE VARIANT NAME: Check for variantName, legacy 'color', or 'name'
    const variantName = variants?.[0]?.variantName || variants?.[0]?.color || variants?.[0]?.name;
    const finalName = variantName || product.productName || product.name;

    return {
        _id: product._id,
        name: finalName,
        price: Math.ceil(bestPrice),
        mrp: Math.ceil(variants?.[0]?.mrp || product.originalPrice || product.mrp || bestPrice + 100),
        discount: product.discount || 0,
        rating: product.avgRating || product.rating || 5,
        reviewCount: product.reviewCount || 0,
        images: product.images || (product.image ? [product.image] : []),
        isBulkOnly: product.isBulkOnly || false,
        slug: product.slug,
        category: product.category,
        variants: variants.map(v => ({
            size: v.size,
            variantName: v.variantName || v.color || v.name,
            totalStock: v.stock || 0,
            reservedStock: v.reservedStock || 0,
            availableStock: Math.max(0, (v.stock || 0) - (v.reservedStock || 0)),
            reorderLevel: v.reorderLevel || 0,
            stockoutDate: v.stockoutDate || null
        })),
        type: product.type || 'wear'
    };
};

module.exports = { formatWearProductForClient };
