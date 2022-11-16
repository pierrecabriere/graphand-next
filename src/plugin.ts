import { GraphandClient, GraphandModel, GraphandPlugin } from "graphand-js";
import { NextPage } from "next";
import { AppType } from "next/app";
import React from "react";
import withGraphand, { WithGraphandOpts } from "./lib/withGraphand";
import withSSR, { WithSSROpts } from "./lib/withSSR";

declare module "graphand-js" {
  class GraphandClient {
    withSSR: (
      inputPage: NextPage<any>,
      inputOpts: Omit<WithSSROpts, "client">,
      fallback?: ReturnType<React.FunctionComponent>,
    ) => ReturnType<typeof withSSR>;

    withGraphand: (app: AppType, inputOpts: Omit<WithGraphandOpts, "client">) => ReturnType<typeof withGraphand>;
  }
}

export type GraphandPluginNextOpts = any;

class GraphandPluginNext extends GraphandPlugin<GraphandPluginNextOpts> {
  static defaultOptions = {};

  onInstall(): any {
    const { client } = this;

    client.withSSR = function (inputPage, inputOpts, fallback) {
      const opts = { ...inputOpts, client };
      return withSSR(inputPage, opts, fallback);
    };

    client.withGraphand = function (app, inputOpts) {
      const opts = { ...inputOpts, client };
      return withGraphand(app, opts);
    };
  }
}

export default GraphandPluginNext;
