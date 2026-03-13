const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const Guide = require('../models/Awareness/guideModel');
const GuideCategory = require('../models/Awareness/guideCategoryModel');

const dbUrl = process.env.DB_URL;

const categoriesList = [
    { name: 'Soil Health', slug: 'soil-health' },
    { name: 'Pest Control', slug: 'pest-control' },
    { name: 'Water Management', slug: 'water-management' },
    { name: 'Crop Planning', slug: 'crop-planning' },
    { name: 'Organic Fertilizers', slug: 'organic-fertilizers' },
    { name: 'Harvesting', slug: 'harvesting' },
    { name: 'Livestock Care', slug: 'livestock-care' },
    { name: 'Market Intelligence', slug: 'market-intelligence' }
];

const staticGuides = [
    // Crop Planning
    { title: 'Perennial Crop Integration', categoryName: 'Crop Planning', season: 'All Season', readTime: '18m read', difficulty: 'Advanced', crops: 'Asparagus, Berries', description: 'Strategies for mixing long-term perennials into an annual garden layout for permanent yields.' },
    { title: 'Succession Planting Mastery', categoryName: 'Crop Planning', season: 'Spring/Summer', readTime: '15m read', difficulty: 'Intermediate', crops: 'Lettuce, Radish', description: 'The clockwork of farming: how to time your plantings for a 365-day harvest cycle.' },
    { title: 'Companion Planting Matrix', categoryName: 'Crop Planning', season: 'All Season', readTime: '20m read', difficulty: 'Beginner', crops: 'Tomato, Basil, Marigold', description: 'Harnessing biological synergies between different crop species to boost growth and health.' },
    { title: 'Intercropping Systems', categoryName: 'Crop Planning', season: 'Kharif', readTime: '14m read', difficulty: 'Advanced', crops: 'Maize, Cowpea', description: 'Growing multiple crops simultaneously in the same space to maximize land use efficiency.' },
    { title: 'Market-Driven Crop Planning', categoryName: 'Crop Planning', season: 'Annual', readTime: '22m read', difficulty: 'Advanced', crops: 'Commercial Veggies', description: 'Syncing your planting schedule with future market demands and price peaks.' },
    { title: 'Crop Rotation for Disease Suppression', categoryName: 'Crop Planning', season: 'Annual', readTime: '16m read', difficulty: 'Intermediate', crops: 'Grains, Legumes', description: 'Breaking the life cycle of soil-borne pathogens through strategic field rotation.' },
    { title: 'Climate-Adaptive Varieties', categoryName: 'Crop Planning', season: 'Dry Season', readTime: '19m read', difficulty: 'Advanced', crops: 'Millets, Sorghum', description: 'Choosing and scheduling drought-resistant crops in anticipation of climate shifts.' },
    { title: 'Garden Layout and Design', categoryName: 'Crop Planning', season: 'Planning Phase', readTime: '13m read', difficulty: 'Beginner', crops: 'All crops', description: 'Optimizing farm layout for airflow, light penetration, and ease of harvest.' },
    { title: 'Cover Crop Strategies', categoryName: 'Crop Planning', season: 'Off-Season', readTime: '17m read', difficulty: 'Intermediate', crops: 'Clover, Rye', description: 'Protecting and feeding the soil during fallow periods with nitrogen-fixing cover crops.' },
    { title: 'Micro-Climate Optimization', categoryName: 'Crop Planning', season: 'All Season', readTime: '25m read', difficulty: 'Advanced', crops: 'Sensitive Veggies', description: 'Using windbreaks, swales, and structures to create ideal conditions for sensitive crops.' },

    // Soil Health
    { title: 'Advanced Soil Testing Protocols', categoryName: 'Soil Health', season: 'Pre-Planting', readTime: '15m read', difficulty: 'Intermediate', crops: 'Soil Prep', description: 'Moving beyond NPK to understand cation exchange, organic matter, and trace minerals.' },
    { title: 'Biochar Production and Application', categoryName: 'Soil Health', season: 'Dry Season', readTime: '20m read', difficulty: 'Advanced', crops: 'All Crops', description: 'Sequestering carbon and building permanent soil structure with high-temperature charcoal.' },
    { title: 'Mycorrhizal Fungi Inoculation', categoryName: 'Soil Health', season: 'Planting', readTime: '14m read', difficulty: 'Intermediate', crops: 'Root Zones', description: 'Establishing symbiotic fungal networks that expand root surface area by 100x.' },
    { title: 'Managing Soil Salinity', categoryName: 'Soil Health', season: 'Post-Monsoon', readTime: '18m read', difficulty: 'Advanced', crops: 'Coastal Crops', description: 'Remediation techniques for saline soils using organic amendments and flushing protocols.' },
    { title: 'No-Till Biological Farming', categoryName: 'Soil Health', season: 'Annual', readTime: '22m read', difficulty: 'Advanced', crops: 'Mainland Crops', description: 'Preserving the delicate soil ecosystem by eliminating mechanical tillage.' },

    // Pest Control
    { title: 'Integrated Pest Management (IPM)', categoryName: 'Pest Control', season: 'All Season', readTime: '19m read', difficulty: 'Intermediate', crops: 'All Crops', description: 'A multi-layered approach to pest management using biological, cultural, and mechanical controls.' },
    { title: 'Beneficial Insect Habitats', categoryName: 'Pest Control', season: 'Spring', readTime: '13m read', difficulty: 'Beginner', crops: 'Wildflowers', description: 'Planting specific flora to attract ladybugs, lacewings, and predatory wasps.' },
    { title: 'Organic Neem Protocols', categoryName: 'Pest Control', season: 'All Season', readTime: '11m read', difficulty: 'Beginner', crops: 'Vegetables', description: 'Safe dilution and application of cold-pressed neem oil for broad-spectrum control.' },
    { title: 'Pheromone Trap Calibration', categoryName: 'Pest Control', season: 'Peak Season', readTime: '14m read', difficulty: 'Intermediate', crops: 'Fruit trees', description: 'Using scents to monitor and disrupt the mating cycles of destructive moths.' },
    { title: 'Biological controls for Aphids', categoryName: 'Pest Control', season: 'Monsoon', readTime: '12m read', difficulty: 'Intermediate', crops: 'Leafy Greens', description: 'Deploying natural predators to handle aphid explosions without chemicals.' },

    // Water Management
    { title: 'Precision Drip Engineering', categoryName: 'Water Management', season: 'Dry Season', readTime: '20m read', difficulty: 'Advanced', crops: 'Orchards', description: 'Designing zero-leak delivery systems with pressure compensation and smart timers.' },
    { title: 'Rainwater Harvesting Systems', categoryName: 'Water Management', season: 'Monsoon', readTime: '16m read', difficulty: 'Advanced', crops: 'Farm-wide', description: 'Constructing catchment zones and ponds to store monsoon overflow for the dry months.' },
    { title: 'Greywater Filtration for Irrigation', categoryName: 'Water Management', season: 'All Season', readTime: '18m read', difficulty: 'Advanced', crops: 'Trees, Shrubs', description: 'Safely reusing household water through biological sand filters.' },
    { title: 'The Art of Mulching', categoryName: 'Water Management', season: 'Summer', readTime: '10m read', difficulty: 'Beginner', crops: 'All Crops', description: 'Using organic waste layers to reduce surface evaporation by up to 60%.' },
    { title: 'Automated Soil Moisture Sensing', categoryName: 'Water Management', season: 'All Season', readTime: '15m read', difficulty: 'Advanced', crops: 'Commercial crops', description: 'Integrating IoT sensors to water only when the plant actually needs it.' },

    // Organic Fertilizers
    { title: 'Liquid Seaweed Extracts', categoryName: 'Organic Fertilizers', season: 'Early growth', readTime: '12m read', difficulty: 'Beginner', crops: 'Foliar Feed', description: 'Boosting plant immunity and hormone levels with high-purity seaweed tea.' },
    { title: 'Jeevamrutha Preparation', categoryName: 'Organic Fertilizers', season: 'All Season', readTime: '16m read', difficulty: 'Intermediate', crops: 'Soil Health', description: 'A traditional microbial culture that dramatically speeds up nutrient release.' },
    { title: 'Bone Meal and Phosphorus', categoryName: 'Organic Fertilizers', season: 'Pre-flowering', readTime: '10m read', difficulty: 'Beginner', crops: 'Root/Flower crops', description: 'The biological source of phosphorus for root development and fruit set.' },
    { title: 'Compost Tea Brewing', categoryName: 'Organic Fertilizers', season: 'Active growth', readTime: '14m read', difficulty: 'Intermediate', crops: 'All Crops', description: 'Aerated liquid compost that delivers billions of beneficial microbes directly to leaves.' },
    { title: 'Green Manure guide', categoryName: 'Organic Fertilizers', season: 'Soil prep', readTime: '15m read', difficulty: 'Beginner', crops: 'Soil Health', description: 'Growing crops just to chop and drop them back into the Earth.' }
];

const generateExtensiveDetailContent = (guide) => {
    const title = guide.title;
    return {
        content: `
            <div style="font-family: inherit; color: #334155;">
                <section style="margin-bottom: 3rem;">
                    <h2 style="font-size: 2.25rem; font-weight: 800; color: #0f172a; margin-bottom: 2rem; letter-spacing: -0.025em;">Executive Summary: ${title}</h2>
                    <p style="font-size: 1.25rem; line-height: 1.75; color: #475569; margin-bottom: 1.5rem;">
                        Welcome to the definitive internal protocol for <strong>${title}</strong>. This document 
                        outlines the convergence of traditional agrarian wisdom with high-stakes modern data 
                        science. In the current era of climate instability, mastering ${title} is no longer 
                        optional; it is the primary differentiator between successful large-scale farms and 
                        subsistence operations.
                    </p>
                    <p style="font-size: 1.125rem; line-height: 1.75; color: #64748b;">
                        Throughout this guide, we will explore the metabolic pathways, environmental constraints, 
                        and economic ROI of implementing this specific technique. We recommend reading this 
                        entire protocol twice—once for the conceptual overview and a second time for technical 
                        calibration.
                    </p>
                </section>

                <div style="background: linear-gradient(135deg, #064e3b 0%, #0f172a 100%); padding: 3rem; border-radius: 2.5rem; color: #ffffff; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); margin: 4rem 0; position: relative; overflow: hidden;">
                    <h3 style="font-size: 1.5rem; font-weight: 700; color: #10b981; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 1.5rem;">Theoretical Foundation</h3>
                    <p style="font-size: 1.125rem; line-height: 1.75; color: #ecfdf5; font-weight: 500;">
                        At its core, ${title} relies on the principle of <em>Ecological Equilibrium</em>. We don't 
                        just "apply" a technique; we initiate a biological chain reaction. Scientific literature 
                        from the last decade has proven that ${guide.categoryName} interventions like this one 
                        result in a 35% reduction in total input costs while concurrently increasing crop 
                        resiliency to thermal shock.
                    </p>
                </div>

                <section style="margin-bottom: 3rem;">
                    <h3 style="font-size: 1.875rem; font-weight: 700; color: #1e293b; margin-bottom: 2rem;">Phase 1: Deep Environmental Profiling</h3>
                    <p style="font-size: 1.125rem; line-height: 1.75; color: #475569; margin-bottom: 2rem;">
                        The success of ${title} is 80% preparation. You must first generate a high-fidelity 
                        map of your farm's micro-environmental variables. This includes Diurnal Temperature 
                        Variance (DTV), Cation Exchange Capacity (CEC), and the specific microbial fingerprint 
                        of your topsoil. Without these data points, any application is merely guesswork.
                    </p>
                    <div style="display: grid; grid-template-columns: 1fr; gap: 2rem; margin-bottom: 3rem;">
                        <div style="padding: 2rem; background: #f8fafc; border-radius: 1.5rem; border: 1px solid #f1f5f9; font-style: italic; font-weight: 600; color: #334155;">
                            "Modern agronomy teaches us that soil is not a medium, but a living organism. ${title} 
                            is the language we use to communicate with that organism."
                        </div>
                    </div>
                </section>

                <section style="margin-bottom: 3rem;">
                    <h3 style="font-size: 1.875rem; font-weight: 700; color: #1e293b; margin-bottom: 2rem;">Phase 2: Technical Execution Protocol</h3>
                    <p style="font-size: 1.125rem; line-height: 1.75; color: #475569; margin-bottom: 2rem;">
                        Precision is the standard. When executing ${title}, timing should be synchronized with 
                        lunar cycles or exact solar positions to maximize biological uptake. UV radiation at 
                        midday can degrade organic catalysts by up to 90%, making late-evening application a 
                        strict requirement for professional operations.
                    </p>
                </section>

                <section style="margin-bottom: 3rem;">
                    <h3 style="font-size: 1.875rem; font-weight: 700; color: #1e293b; margin-bottom: 2rem;">Phase 3: Scaling and Economic Viability</h3>
                    <p style="font-size: 1.125rem; line-height: 1.75; color: #475569; margin-bottom: 2.5rem;">
                        Once the protocol is proven on a 1-acre control plot, scaling should be conducted in 
                        25% increments. This allows the local ecosystem—including earthworms and beneficial 
                        insect populations—to adapt to the shifting nutrient and management dynamics without 
                        experiencing a collapse in diversity.
                    </p>
                    <div style="background: #020617; padding: 3rem; border-radius: 2.5rem; text-align: center;">
                        <h4 style="font-size: 2.5rem; font-weight: 900; color: #ffffff; margin-bottom: 1rem;">40% INCREASE</h4>
                        <p style="color: #10b981; font-weight: 900; text-transform: uppercase; letter-spacing: 0.3em; font-size: 0.875rem; margin: 0;">Projected Efficiency Gain</p>
                    </div>
                </section>
            </div>
        `,
        scientificAnalysis: `
            Our regional research laboratories have conducted longitudinal studies on ${title}. The findings 
            indicate that this practice results in a statistically significant increase in secondary 
            metabolites within the fruit and foliage. Specifically, HPLC analysis reveals a 22% spike in 
            polyphenol content, which directly correlates to improved pest resistance and better shelf-life. 
            Furthermore, the soil hydraulic conductivity increases by 3.4cm/hr, allowing for vastly superior 
            drainage during monsoon events.
        `,
        steps: [
            "Baseline Data Collection: Measure soil pH, EC, and NPK at 10 different points across the plot.",
            "Material Sanitization: Ensure all organic inputs are free from weed seeds and pathogenic bacteria.",
            "Reagent Preparation: Mix primary organic catalysts in a ratio of 1:100 with chlorine-free water.",
            "Atmospheric Check: Verify ambient humidity is above 40% to prevent rapid evaporation of sprayers.",
            "Initial Application: Apply the solution during the 'Golden Hour' (sunset) for maximum microbial survival.",
            "Metabolic Monitoring: Re-test foliage sap 72 hours post-application for nutrient uptake confirmation.",
            "Iterative Feedback: Adjust the second dosage based on the observed growth rate of the target crop.",
            "Documentation: Log all variables into the digital hub for season-to-season comparison.",
            "Scaling Phase: After successful control plot results, expand to the secondary 5-acre zone.",
            "Bio-Diversity Audit: Conduct a count of earthworm castings per square meter to verify soil life improvement.",
            "Economic Review: Calculate the input cost savings compared to the previous chemical-based season.",
            "Final Protocol Archiving: Store the successful parameters as your farm's gold standard for this crop."
        ],
        maintenance: [
            "Weekly Sap Analysis: Monitor plant health at a cellular level using a handheld refractometer.",
            "Irrigation Flush: Clear all drip lines weekly if using organic liquids to prevent biofilm buildup.",
            "Microbial Boost: Re-introduce a small 10% booster dose every 21 days to maintain population levels.",
            "Mulch Integrity: Ensure a consistent 3-inch layer of organic mulch is maintained atop the root zones.",
            "Digital Logging: Update the application logs within 2 hours of every farm intervention.",
            "Tool Calibration: Annually check and repair all application machinery for precision delivery."
        ],
        troubleshooting: [
            "Low Sap Brix Reading: Increase the concentration of seaweed extract catalysts by 15% immediately.",
            "Whitefily Infestation: Deploy yellow sticky traps and increase the frequency of Neem spray protocols.",
            "Soil Compaction: Implement localized aeration or introduce deep-rooted cover crops like Daikon radish.",
            "Nutrient Leaching: If heavy rain occurs within 12 hours, a half-strength re-dose is required post-monsoon."
        ],
        benefits: [
            "Long-term Soil sponge creation, reducing total irrigation requirements by up to 50%.",
            "Enhanced Antioxidant profiles in final harvest, allowing for premium price positioning.",
            "Zero chemical toxicity, ensuring the health and safety of the farming family and laborers.",
            "Restoration of local pollinators, including bees and butterflies, to the farm ecosystem.",
            "Dramatic reduction in annual overhead costs by eliminating synthetic fertilizer purchases.",
            "Protection against extreme weather events (heat/cold) through improved plant cell turgidity.",
            "Certified Organic alignment, opening doors to high-value international export markets.",
            "Permanent improvement of land value through the restoration of topsoil organic matter.",
            "Significant reduction in carbon footprint by sequestering nitrogen directly into the soil.",
            "Creation of a resilient, self-sustaining farm that requires fewer interventions over time."
        ]
    };
};

async function seed() {
    try {
        await mongoose.connect(dbUrl);
        console.log('Connected to database...');

        await GuideCategory.deleteMany({});
        await Guide.deleteMany({});
        console.log('Cleared database.');

        const categoryMap = {};
        for (const cat of categoriesList) {
            const created = await GuideCategory.create(cat);
            categoryMap[cat.name] = created._id;
        }

        for (const g of staticGuides) {
            const details = generateExtensiveDetailContent(g);
            const cleanSlug = g.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            
            await Guide.create({
                category: categoryMap[g.categoryName],
                heading: g.title,
                slug: cleanSlug,
                level: g.difficulty,
                difficulty: g.difficulty,
                description: g.description,
                content: details.content,
                scientificAnalysis: details.scientificAnalysis,
                steps: details.steps,
                maintenance: details.maintenance,
                troubleshooting: details.troubleshooting,
                benefits: details.benefits,
                readTime: g.readTime,
                crops: [g.crops],
                districts: ['All'],
                isActive: true
            });
        }

        console.log('Seeding completed successfully with High-Contrast Styles!');
        process.exit(0);
    } catch (error) {
        console.error('Seeding error:', error);
        process.exit(1);
    }
}

seed();
