// /**
//  * Display a toast notification based on the type of message.
//  *
//  * This utility function provides a consistent way to show user-friendly
//  * toast notifications for both success and error messages. It leverages
//  * the `react-toastify` library and applies dynamic styling based on the
//  * type of notification (`success` or `error`).
//  *
//  * ### How It Works
//  * - Accepts a `type` parameter (`success` or `error`) to determine the type of toast.
//  * - Accepts a `message` parameter for the content of the toast notification.
//  * - Applies preconfigured options for position, duration, and style, ensuring
//  *   a unified look and feel across the application.
//  *
//  * ### Styling
//  * - **Success Toast**:
//  *   - Background: Dark gray (#1C2833)
//  *   - Text color: Teal green (#1ABC9C)
//  * - **Error Toast**:
//  *   - Background: Dark gray (#1C2833)
//  *   - Text color: Red (#DC3545)
//  *
//  * ### Use Cases
//  * 1. **Success Notification**: Display confirmation messages for successful operations,
//  *    such as saving a record, completing a game move, or submitting a form.
//  *    Example:
//  *    ```javascript
//  *    showToast("success", "Move successful!");
//  *    ```
//  *
//  * 2. **Error Notification**: Display error messages when an operation fails,
//  *    such as invalid input, server errors, or unauthorized access.
//  *    Example:
//  *    ```javascript
//  *    showToast("error", "Invalid move. Please try again.");
//  *    ```
//  *
//  * ### Dependencies
//  * - Ensure `react-toastify` is installed in your project.
//  * - Include the `ToastContainer` component in your root application file (`App.js` or `index.js`):
//  *   ```javascript
//  *   import { ToastContainer } from "react-toastify";
//  *   import "react-toastify/dist/ReactToastify.css";
//  *
//  *   function App() {
//  *       return (
//  *           <div>
//  *               <ToastContainer />
//  *               {/* Other components */}
//  *           </div>
//  *      
//  *   
//  *   
//  *
//  * @param {string} type - The type of toast message. Must be either "success" or "error".
//  * @param {string} message - The message to display in the toast notification.
//  */


import { toast } from "react-toastify";


export const showToast = (type, message) => {
    const options = {
        position: "top-center",  // Display the toast at the top center of the screen
        autoClose: 2000,        // Auto-close the toast after 2000 milliseconds (2 seconds)
        hideProgressBar: false, // Show the progress bar
        closeOnClick: true,     // Allow the user to close the toast by clicking on it
        pauseOnHover: true,     // Pause the auto-close timer when hovering over the toast
        draggable: true,        // Allow dragging the toast
        progress: undefined,    // Use default progress bar settings
        theme: "colored",       // Use the colored theme for the toast
        closeButton: false,     // Disable the close button for simplicity
        style: {
            background: type === "success" ? "#000000" : "#000000", // Same dark background for all toasts
            color: type === "success" ? "white" : "#DC3545",      // Teal for success, red for error
        },
    };

    // Trigger the appropriate toast based on the type
    if (type === "success") {
        toast.success(message, options);
    } else {
        toast.error(message, options);
    }
};
