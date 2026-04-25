import { createSlice } from "@reduxjs/toolkit"
import { toast } from "react-hot-toast"

const initialState = {
  cart: sessionStorage.getItem("cart")
    ? JSON.parse(sessionStorage.getItem("cart"))
    : [],
  total: sessionStorage.getItem("total")
    ? JSON.parse(sessionStorage.getItem("total"))
    : 0,
  totalItems: sessionStorage.getItem("totalItems")
    ? JSON.parse(sessionStorage.getItem("totalItems"))
    : 0,
}

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    addToCart: (state, action) => {
      const course = action.payload
      const index = state.cart.findIndex((item) => item._id === course._id)

      if (index >= 0) {
        // If the course is already in the cart, do not modify the quantity
        toast.error("Course already in cart")
        return;
      }
      // If the course is not in the cart, add it to the cart
      state.cart.push(course);
      // Update the total quantity and price
      state.totalItems++;
      state.total += course.price;
      // Update to localstorage
      sessionStorage.setItem("cart", JSON.stringify(state.cart));
      sessionStorage.setItem("total", JSON.stringify(state.total));
      sessionStorage.setItem("totalItems", JSON.stringify(state.totalItems));
      // show toast
      toast.success("Course added to cart");
    },

    removeFromCart: (state, action) => {
      const courseId = action.payload;
      const index = state.cart.findIndex((item) => item._id === courseId);

      if (index >= 0) {
        // If the course is found in the cart, remove it
        state.totalItems--;
        state.total -= state.cart[index].price;
        state.cart.splice(index, 1);
        // Update to localstorage
        sessionStorage.setItem("cart", JSON.stringify(state.cart));
        sessionStorage.setItem("total", JSON.stringify(state.total));
        sessionStorage.setItem("totalItems", JSON.stringify(state.totalItems));
        // show toast
        toast.success("Course removed from cart");
      }
    },

    resetCart: (state) => {
      state.cart = [];
      state.total = 0;
      state.totalItems = 0;
      // Update to localstorage
      sessionStorage.removeItem("cart");
      sessionStorage.removeItem("total");
      sessionStorage.removeItem("totalItems");
    },
  },
})

export const { addToCart, removeFromCart, resetCart } = cartSlice.actions;

export default cartSlice.reducer;