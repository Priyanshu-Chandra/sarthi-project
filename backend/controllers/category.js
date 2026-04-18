const Category = require('../models/category')

// get Random Integer
function getRandomInt(max) {
    return Math.floor(Math.random() * max)
}

// ================ create Category ================
exports.createCategory = async (req, res) => {
    try {
        // extract data
        const { name, description } = req.body;

        // validation
        if (!name || !description) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        const categoryDetails = await Category.create({
            name: name, description: description
        });

        res.status(200).json({
            success: true,
            message: 'Category created successfully'
        });
    }
    catch (error) {
        console.log('Error while creating Category');
        console.log(error);
        res.status(500).json({
            success: false,
            message: 'Error while creating Category',
            error: error.message
        })
    }
}


// ================ delete Category ================
exports.deleteCategory = async (req, res) => {
    try {
        // extract data
        const { categoryId } = req.body;

        // validation
        if (!categoryId) {
            return res.status(400).json({
                success: false,
                message: 'categoryId is required'
            });
        }

        await Category.findByIdAndDelete(categoryId);

        res.status(200).json({
            success: true,
            message: 'Category deleted successfully'
        });
    }
    catch (error) {
        console.log('Error while deleting Category');
        console.log(error);
        res.status(500).json({
            success: false,
            message: 'Error while deleting Category',
            error: error.message
        })
    }
}


// ================ get All Category ================
exports.showAllCategories = async (req, res) => {
    try {
        // get all category from DB
        const allCategories = await Category.find({}, { name: true, description: true });

        // return response
        res.status(200).json({
            success: true,
            data: allCategories,
            message: 'All allCategories fetched successfully'
        })
    }
    catch (error) {
        console.log('Error while fetching all allCategories');
        console.log(error);
        res.status(500).json({
            success: false,
            message: 'Error while fetching all allCategories'
        })
    }
}



// ================ Get Category Page Details ================
exports.getCategoryPageDetails = async (req, res) => {
    try {
        const { categoryId } = req.body
        // console.log("PRINTING CATEGORY ID: ", categoryId);

        // Get courses for the specified category
        const selectedCategory = await Category.findById(categoryId)
            .populate({
                path: "courses",
                match: { status: "Published" },
                populate: [
                    { path: "instructor" },
                    { path: "ratingAndReviews" }
                ],
            })
            .exec()

        // Handle the case when the category is not found
        if (!selectedCategory) {
            return res.status(404).json({ success: false, message: "Category not found" })
        }

        // Handle the case when there are no courses
        if (selectedCategory.courses.length === 0) {
            return res.status(404).json({
                success: false,
                data: null,
                message: "No courses found for the selected category.",
            })
        }

        // --- NEW: Category-Specific Sorting ---
        // 1. Most Popular (Top Selling) in THIS category
        const mostPopularCourses = [...selectedCategory.courses]
            .sort((a, b) => b.studentsEnrolled.length - a.studentsEnrolled.length)
            .slice(0, 10);

        // 2. Newest in THIS category
        const newestCourses = [...selectedCategory.courses]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        
        // --- End New Sorting ---

        // Get courses for other categories
        const categoriesExceptSelected = await Category.find({
            _id: { $ne: categoryId },
        })

        let differentCategory = await Category.findOne(
            categoriesExceptSelected[getRandomInt(categoriesExceptSelected.length)]
                ._id
        )
            .populate({
                path: "courses",
                match: { status: "Published" },
                populate: [
                    { path: "instructor" },
                    { path: "ratingAndReviews" }
                ],
            })
            .exec()

        // Get top-selling courses across all categories
        const allCategories = await Category.find()
            .populate({
                path: "courses",
                match: { status: "Published" },
                populate: [
                    { path: "instructor" },
                    { path: "ratingAndReviews" }
                ],
            })
            .exec()

        const allCourses = allCategories.flatMap((category) => category.courses)
        const mostSellingCourses = allCourses
            .sort((a, b) => (b.studentsEnrolled?.length || 0) - (a.studentsEnrolled?.length || 0))
            .slice(0, 10)

        res.status(200).json({
            success: true,
            data: {
                selectedCategory,
                differentCategory,
                mostSellingCourses,
                mostPopularCourses, // Tab 1
                newestCourses,     // Tab 2
            },
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        })
    }
}