import DownloadForm, { DownloadFormRef } from "@/components/DownloadForm";
import { Button } from "@/components/ui/button";
import WebView from "@/components/WebView";
import useElectron from "@/hooks/electron";
import {
  BrowserStatus,
  PageMode,
  selectBrowserStore,
  setBrowserStore,
} from "@/store";
import { DownloadType } from "@/types";
import { generateUrl } from "@/utils";
import { Empty, Space, Spin, message } from "antd";
import { produce } from "immer";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

interface SourceData {
  id: number;
  url: string;
  documentURL: string;
  name: string;
  type: DownloadType;
  headers?: string;
}

export function BrowserView() {
  const {
    webviewLoadURL,
    addIpcListener,
    removeIpcListener,
    webviewGoHome,
    downloadNow,
    addDownloadItem,
    showDownloadDialog: ipcShowDownloadDialog,
  } = useElectron();
  const downloadForm = useRef<DownloadFormRef>(null);
  const store = useSelector(selectBrowserStore);
  const { t } = useTranslation();
  const [modalShow, setModalShow] = useState(false);
  const [placeHolder, setPlaceHolder] = useState<string>("");
  const dispatch = useDispatch();
  const [messageApi, contextHolder] = message.useMessage();
  const [sources, setSources] = useState<SourceData[]>([]);

  useEffect(() => {
    const onShowDownloadDialog = async (
      e: unknown,
      data: DownloadItem[],
      image: string,
    ) => {
      // FIXME: 选择
      setCurrentDownloadForm(data[0]);

      setPlaceHolder(image);
      setModalShow(true);
    };

    const onWebviewLinkMessage = async (e: unknown, data: any) => {
      console.log(data);
      setSources(
        produce((draft) => {
          draft.push(data);
        }),
      );
    };

    addIpcListener("show-download-dialog", onShowDownloadDialog);
    addIpcListener("webview-link-message", onWebviewLinkMessage);

    return () => {
      removeIpcListener("show-download-dialog", onShowDownloadDialog);
      removeIpcListener("webview-link-message", onWebviewLinkMessage);
    };
  }, [store.status]);

  const onClickGoHome = async () => {
    await webviewGoHome();
    dispatch(
      setBrowserStore({
        url: "",
        title: "",
        mode: PageMode.Default,
      }),
    );
  };

  const confirmDownload = async (now?: boolean) => {
    try {
      const data = downloadForm.current.getFieldsValue();

      if (now) {
        await downloadNow(data);
      } else {
        await addDownloadItem(data);
      }

      // 提交成功后关闭弹窗
      setModalShow(false);

      return true;
    } catch (e) {
      messageApi.error((e as any).message);
      return false;
    }
  };

  // 设置当前的下载表单
  const setCurrentDownloadForm = async (data: DownloadItem) => {
    const { type, url, name, headers } = data;

    downloadForm.current.setFieldsValue({
      type,
      url,
      name,
      headers,
    });
  };

  const loadUrl = (url: string) => {
    dispatch(
      setBrowserStore({
        url,
        mode: PageMode.Browser,
        status: BrowserStatus.Loading,
      }),
    );
    webviewLoadURL(url);
  };

  const goto = () => {
    const link = generateUrl(store.url);
    loadUrl(link);
  };

  // 渲染表单
  const renderModalForm = () => {
    return (
      <DownloadForm
        isEdit
        ref={downloadForm}
        open={modalShow}
        onOpenChange={setModalShow}
        onDownloadNow={() => confirmDownload(true)}
        onAddToList={() => confirmDownload()}
        destroyOnClose
      />
    );
  };

  const renderContent = () => {
    // 加载状态
    if (store.status === BrowserStatus.Loading) {
      return <Spin />;
    }

    // 模态框
    if (modalShow) {
      return <img src={placeHolder} className="h-full w-full" />;
    }

    // 加载失败
    if (store.status === BrowserStatus.Failed) {
      return (
        <Empty
          description={`${store.errMsg || t("loadFailed")} (${store.errCode})`}
        >
          <Space>
            <Button onClick={onClickGoHome}>{t("backToHome")}</Button>
            <Button onClick={goto}>{t("refresh")}</Button>
          </Space>
        </Empty>
      );
    }

    // 加载成功
    if (store.status === BrowserStatus.Loaded) {
      return <WebView className="h-full w-full flex-1" />;
    }

    return null;
  };

  const renderSidePanel = () => {
    if (sources.length === 0) {
      return null;
    }

    return (
      <div className="mx-2 flex h-full flex-col gap-3 overflow-y-auto rounded-lg bg-white p-3">
        {sources.map((item, index) => {
          return (
            <div
              className="min-w-60 max-w-60 break-all rounded-lg bg-[#FAFCFF] bg-red-900 p-3"
              key={index}
            >
              <span
                className="line-clamp-2 cursor-default text-sm text-[#343434]"
                title={item.name}
              >
                {item.name}
              </span>
              <span className="cursor-default text-xs" title={item.url}>
                {item.url}
              </span>
              <div>
                <Button
                  onClick={() => {
                    ipcShowDownloadDialog([item]);
                  }}
                >
                  {t("addToDownloadList")}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex h-full flex-1">
        {renderContent()}
        {renderSidePanel()}
      </div>
      {renderModalForm()}
      {contextHolder}
    </div>
  );
}
