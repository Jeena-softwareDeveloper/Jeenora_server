const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.DB_URL;

async function migrate() {
    try {
        await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;
        const wearProducts = db.collection('wearproducts');

        const cursor = wearProducts.find({ "variants.color": { $exists: true } });
        let count = 0;

        while (await cursor.hasNext()) {
            const doc = await cursor.next();
            const updatedVariants = doc.variants.map(v => {
                if (v.color !== undefined) {
                    v.variantName = v.color;
                    delete v.color;
                }
                return v;
            });

            await wearProducts.updateOne(
                { _id: doc._id },
                { $set: { variants: updatedVariants } }
            );
            count++;
        }

        console.log(`Migrated ${count} products. Name properly changed from color to variantName!`);
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await mongoose.disconnect();
    }
}

migrate();
