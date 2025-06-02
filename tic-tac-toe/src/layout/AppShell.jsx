// AppShell.jsx
import "./layout.css";
import TrinityDrawer from "../components/trinity/TrinityDrawer"; // ✅ Import here
import { useUI } from "../components/context/uiContext"; // ✅ Make sure context is available

const AppShell = ({ children }) => {
    const { isTrinityOpen } = useUI(); // get state

    return (
        <div className="app-shell">
            {children}

            {/* ✅ Render TrinityDrawer outside of the FriendsSidebar tree */}
            {isTrinityOpen && <TrinityDrawer />}
        </div>
    );
};

export default AppShell;
