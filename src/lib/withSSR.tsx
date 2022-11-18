import { deepEqual } from "fast-equals";
import GraphandClient, { GraphandModel, GraphandModelList } from "graphand-js";
import { GetServerSidePropsContext, NextPage } from "next";
import React, { useEffect, useRef, useState } from "react";

type WithSSRData = {
  [key: string]: GraphandModel | GraphandModelList<GraphandModel> | any;
};

type ParsedContext = any;

export type WithSSROpts = {
  client: GraphandClient;
  getData?: (context: GetServerSidePropsContext | ParsedContext) => WithSSRData | Promise<WithSSRData>;
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
  parseContextSSG?: (context: GetServerSidePropsContext) => ParsedContext;
  fallback?: React.ReactNode;
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
  parseContextSSG: () => {
    return {};
  },
};

function withSSR(
  inputPage: NextPage<any>,
  inputOpts: WithSSROpts,
  fallback: WithSSROpts["fallback"] = <>Loading ...</>,
): { page: NextPage; getServerSideProps: any } {
  const opts = Object.assign({}, defaultOpts, inputOpts) as WithSSROpts;

  fallback = inputOpts?.fallback ?? fallback;

  const page: NextPage<any> = ({ __ctx, __data, ...props }) => {
    const initializedRef = useRef<boolean>(false);
    const readyRef = useRef<boolean>(false);
    const injectedPropsRef = useRef<any>({});
    const prevDataRef = useRef<any>(__data);
    const [reload, setReload] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(false);
    const skipSSR = useRef<boolean>(Boolean(process.env.SKIP_SSR)).current;

    const _build = async (reload = true) => {
      try {
        let newProps = {};

        if (__data) {
          const data = JSON.parse(__data);
          newProps = opts.rebuildSSR(data, opts.client);
        } else if (skipSSR) {
          setLoading(true);
          try {
            const data = await opts.getData(__ctx || {});
            newProps = opts.rebuildSSG(data, opts.client);
          } catch (e) {}
          setLoading(false);
        }

        readyRef.current = true;
        reload = reload && !deepEqual(newProps, injectedPropsRef.current);
        injectedPropsRef.current = newProps;

        if (reload) {
          setReload((r) => r + 1);
        }
      } catch (e) {
        console.error(e);
      }
    };

    useEffect(() => {
      if (__ctx) {
        _build();
      }
    }, [__ctx]);

    useEffect(() => {
      if (!deepEqual(__data, prevDataRef.current)) {
        prevDataRef.current = __data;
        _build();
      }
    }, [__data]);

    if (!initializedRef.current) {
      initializedRef.current = true;
      _build(skipSSR);
    }

    if (!readyRef.current) {
      return fallback;
    }

    return React.createElement(inputPage, {
      ...props,
      ...injectedPropsRef.current,
      isSSGLoading: loading,
    }) as any;
  };

  const getServerSideProps = async function (ctx: GetServerSidePropsContext) {
    const skipSSR = Boolean(process.env.SKIP_SSR);

    if (skipSSR) {
      return {
        props: {
          __ctx: opts.parseContextSSG(ctx),
        },
      };
    }

    const data = await opts.getData(ctx);
    if (!data) {
      return {
        notFound: true,
      };
    }

    const encodedData = (await opts.encodeData(data, opts.client)) || {};

    return {
      props: {
        __data: JSON.stringify(encodedData),
      },
    };
  };

  return { page, getServerSideProps };
}

export default withSSR;
