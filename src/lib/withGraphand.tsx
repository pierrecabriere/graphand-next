import GraphandClient from "graphand-js";
import App, { AppContext, AppType } from "next/app";

export type WithGraphandOpts = {
  client: GraphandClient;
  server?: (context: AppContext) => void;
};

function withGraphand(app: AppType, inputOpts: WithGraphandOpts) {
  let _initialized = false;

  inputOpts.client._init();

  const _getInitialProps = app.getInitialProps || App.getInitialProps;
  app.getInitialProps = async (context: AppContext) => {
    if (!_initialized) {
      _initialized = true;

      inputOpts?.server?.apply(undefined, [context]);
    }

    return _getInitialProps.apply(app, [context]);
  };

  return app;
}

export default withGraphand;
