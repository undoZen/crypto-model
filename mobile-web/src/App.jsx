import { Icon, TabBar } from "antd-mobile";
import React, { useLayoutEffect } from "react";
import {
  Redirect,
  Route,
  useHistory,
  useLocation,
  useRouteMatch,
} from "react-router-dom";
import "./App.css";
import TopList from "./pages/top-list/counter";
import Counter from "./pages/counter";

function ScrollToTop() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    document.querySelector(".am-tabs-pane-wrap-active").scrollTo(0, 0);
  }, [pathname]);
  return null;
}
function App() {
  const matchPortfolioRoute = useRouteMatch({
    path: "/portfolio",
  });
  const matchTopListRoute = useRouteMatch({
    path: "/top-list",
  });
  const rootRoutePath = matchPortfolioRoute?.path || matchTopListRoute?.path;
  const history = useHistory();
  if (!rootRoutePath) {
    return <Redirect to="/portfolio" />;
  }

  return (
    <div style={{ position: "fixed", height: "100%", width: "100%", top: 0 }}>
      <ScrollToTop />
      <TabBar
        unselectedTintColor="#949494"
        tintColor="#33A3F4"
        barTintColor="white"
        tabBarPosition="bottom"
        prerenderingSiblingsNumber={0}
      >
        <TabBar.Item
          title="Portfolio"
          key="Portfolio"
          selected={rootRoutePath === "/portfolio"}
          // badge={1}
          onPress={() => {
            history.push("/portfolio");
          }}
          icon={<Icon type="check-circle-o" size="md" />}
          selectedIcon={<Icon type="check-circle" size="md" />}
        >
          <Route path="/portfolio">
            <Counter />
          </Route>
        </TabBar.Item>
        <TabBar.Item
          title="TopList"
          key="TopList"
          selected={rootRoutePath === "/top-list"}
          onPress={() => {
            history.push("/top-list");
          }}
          icon={<Icon type="cross-circle" size="md" />}
          selectedIcon={<Icon type="cross-circle-o" size="md" />}
        >
          <Route path="/top-list">
            <TopList />
          </Route>
        </TabBar.Item>
      </TabBar>
    </div>
  );
}

export default App;
