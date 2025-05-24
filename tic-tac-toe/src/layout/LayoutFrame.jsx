import "./layout.css"

const LayoutFrame = ({ children }) => {
    return (
        <div className="layout-frame">
        {children}
        </div>
    );
};

export default LayoutFrame;
