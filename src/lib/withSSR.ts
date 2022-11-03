import GraphandClient, { GraphandModel, GraphandModelList } from "graphand-js";
import { GetServerSidePropsContext, NextPage } from "next";
import { withRouter } from "next/router";
import React from "react";

type WithSSRData = {
  [key: string]: GraphandModel | GraphandModelList<GraphandModel> | any;
};

export type WithSSROpts = {
  client: GraphandClient;
  getData?: (router: GetServerSidePropsContext) => WithSSRData | Promise<WithSSRData>;
  encodeData?: (
    data: WithSSRData,
    client: GraphandClient,
  ) =>
    | {
        __modelsSerials: any;
        __instancesSerials: any;
        __data: any;
      }
    | any;
  rebuildSSR?: (
    data: WithSSRData,
    client: GraphandClient,
  ) =>
    | {
        __data: any;
        payload: any;
      }
    | any;
  rebuildSSG?: (data: WithSSRData, client: GraphandClient) => any;
};

const defaultOpts: Partial<WithSSROpts> = {
  getData: () => {
    return {};
  },
  encodeData: async (data) => {
    const res: any = {
      __modelsSerials: {},
      __instancesSerials: {},
      __data: {},
    };
    const __data: any = {};

    Object.keys(data).forEach((key) => {
      const value = data[key];
      if (typeof value?.serialize === "function") {
        const Model = value._model || value.constructor;
        const scope = Model.scope;
        if (!res.__modelsSerials[scope]) {
          res.__modelsSerials[scope] = Model.serializeModel().then((r: string) => (res.__modelsSerials[scope] = r));
        }

        res.__instancesSerials[key] = value.serialize();
      } else {
        __data[key] = value;
      }
    });

    res.__data = JSON.stringify(__data);

    await Promise.all(Object.values(res.__modelsSerials));

    return res;
  },
  rebuildSSR: (data, client) => {
    const payload: any = {};

    Object.keys(data.__modelsSerials).forEach((modelScope) => {
      const Model = client.getModel(modelScope);
      Model.rebuildModel(data.__modelsSerials[modelScope]);
    });

    Object.keys(data.__instancesSerials).forEach((instanceKey) => {
      const instance = client.hydrate(data.__instancesSerials[instanceKey], true);

      payload[instanceKey] = instance;
    });

    const __data = JSON.parse(data.__data);

    return { ...__data, ...payload };
  },
  rebuildSSG: (data: WithSSRData) => {
    return data;
  },
};

function withSSR(
  inputPage: NextPage<any>,
  inputOpts: WithSSROpts,
  fallback: ReturnType<React.Component["render"]> = "Chargement ...",
): { page: NextPage; getServerSideProps: any } {
  const opts = Object.assign({}, defaultOpts, inputOpts) as WithSSROpts;

  let page, getServerSideProps;
  page = class SSRComponent extends React.Component<any, any> {
    state = {
      ready: false,
      injectProps: {},
    };

    constructor(props: any) {
      super(props);

      this._build(props, false);
    }

    componentDidUpdate(prevProps: any, prevState: any) {
      if (this.props.router.query !== prevProps.router.query) {
        this._build(this.props);
      }
    }

    async _build(props = this.props, runtime = true) {
      try {
        let injectProps = {};

        if (process.env.NEXT_PUBLIC_SKIP_SSR) {
          const data = await opts.getData(props.router as GetServerSidePropsContext);
          injectProps = opts.rebuildSSG(data, opts.client);
        } else {
          const data = JSON.parse(props.data);
          injectProps = opts.rebuildSSR(data, opts.client);
        }

        if (!runtime && !process.env.SKIP_SSR) {
          this.state.injectProps = injectProps;
          this.state.ready = true;
        } else {
          this.setState({ injectProps, ready: true });
        }
      } catch (e) {
        console.error(e);
      }
    }

    render() {
      if (!this.state.ready) {
        return fallback;
      }

      const _props = {
        ...this.props,
        ...this.state.injectProps,
      };

      return React.createElement(inputPage, _props);
    }
  };

  page = withRouter(page);

  if (!process.env.NEXT_PUBLIC_SKIP_SSR) {
    getServerSideProps = async function (ctx: GetServerSidePropsContext) {
      const data = await opts.getData(ctx);
      if (!data) {
        return {
          notFound: true,
        };
      }

      const encodedData = (await opts.encodeData(data, opts.client)) || {};

      return {
        props: {
          data: JSON.stringify(encodedData),
        },
      };
    };
  }

  return { page, getServerSideProps };
}

export default withSSR;
