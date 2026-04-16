import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import TopNav from "./TopNav";
import { useAuth, useLogout } from "../hooks";
export default function Layout({ children }) {
    const location = useLocation();
    const { data: auth } = useAuth();
    const { mutate: logout } = useLogout();
    return (
    // 1. 外层：加上 flex flex-col w-full 保证根节点满宽且向下排布
    _jsxs("div", { className: "flex flex-col w-full", style: {
            minHeight: "100vh",
            background: "var(--color-bg)",
            position: "relative",
            overflow: "hidden",
        }, children: [_jsxs("div", { className: "pointer-events-none", style: { position: "fixed", inset: 0, zIndex: 0 }, children: [_jsx("div", { style: {
                            position: "absolute",
                            width: "800px",
                            height: "800px",
                            top: "-300px",
                            left: "-200px",
                            background: "radial-gradient(circle, rgba(124,106,247,0.12) 0%, transparent 60%)",
                            filter: "blur(80px)",
                        } }), _jsx("div", { style: {
                            position: "absolute",
                            width: "600px",
                            height: "600px",
                            top: "100px",
                            right: "-150px",
                            background: "radial-gradient(circle, rgba(79,70,229,0.09) 0%, transparent 60%)",
                            filter: "blur(80px)",
                        } }), _jsx("div", { style: {
                            position: "absolute",
                            width: "500px",
                            height: "500px",
                            bottom: "-100px",
                            left: "30%",
                            background: "radial-gradient(circle, rgba(124,106,247,0.07) 0%, transparent 60%)",
                            filter: "blur(80px)",
                        } })] }), _jsxs("div", { className: "flex flex-col flex-1 w-full", style: { position: "relative", zIndex: 1 }, children: [_jsx(TopNav, { username: auth?.user?.traktUsername ?? null, onLogout: () => logout() }), _jsx("main", { className: "flex flex-col flex-1 w-full", children: _jsx(AnimatePresence, { mode: "wait", children: _jsx(motion.div, { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -4 }, transition: { duration: 0.18 }, 
                                // 4. Motion Div (这一步最关键！它是直接包裹子页面的盒子)：加上完整的宽高伸缩属性
                                className: "flex flex-col flex-1 w-full", children: children }, location.pathname) }) })] })] }));
}
//# sourceMappingURL=Layout.js.map