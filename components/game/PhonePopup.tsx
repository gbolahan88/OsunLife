"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  BriefcaseBusiness,
  Camera,
  CarFront,
  Check,
  Clock,
  HeartPulse,
  Landmark,
  Mail,
  MessageCircle,
  Settings,
  ShoppingBag,
  Smartphone,
  Wallet,
  X,
} from "lucide-react";

type PhoneApp = {
  id: string;
  name: string;
  Icon: typeof Smartphone;
  color: string;
  description: string;
};

const PHONE_APPS: PhoneApp[] = [
  {
    id: "bank",
    name: "Bank",
    Icon: Landmark,
    color: "#1677e8",
    description: "Manage your money and bank account.",
  },
  {
    id: "health",
    name: "Health",
    Icon: HeartPulse,
    color: "#f04462",
    description: "Check your character's health and wellbeing.",
  },
  {
    id: "messages",
    name: "Messages",
    Icon: MessageCircle,
    color: "#20b86a",
    description: "Your messages and conversations will appear here.",
  },
  {
    id: "invest",
    name: "Invest",
    Icon: ArrowUpRight,
    color: "#7955e8",
    description: "Explore investment opportunities in Osun Life.",
  },
  {
    id: "shop",
    name: "Shop",
    Icon: ShoppingBag,
    color: "#ff922b",
    description: "Browse products and items to buy.",
  },
  {
    id: "ride",
    name: "Ride",
    Icon: CarFront,
    color: "#252b35",
    description: "Find a ride around Osogbo.",
  },
  {
    id: "contacts",
    name: "Contacts",
    Icon: Smartphone,
    color: "#2684ff",
    description: "Your contacts will appear here.",
  },
  {
    id: "camera",
    name: "Camera",
    Icon: Camera,
    color: "#4a5361",
    description: "Capture moments around your virtual world.",
  },
  {
    id: "jobs",
    name: "Jobs",
    Icon: BriefcaseBusiness,
    color: "#147d64",
    description: "Find work and earn money in Osun Life.",
  },
  {
    id: "wallet",
    name: "Wallet",
    Icon: Wallet,
    color: "#16a085",
    description: "View your wallet and available funds.",
  },
  {
    id: "mail",
    name: "Mail",
    Icon: Mail,
    color: "#e85d75",
    description: "Your emails will appear here.",
  },
  {
    id: "settings",
    name: "Settings",
    Icon: Settings,
    color: "#687483",
    description: "Customize your phone preferences.",
  },
];

const DOCK_APPS = ["phone", "messages", "camera", "settings"];

export default function PhonePopup({
  username,
  cash,
  onClose,
}: {
  username: string;
  cash: number;
  onClose: () => void;
}) {
  const [activeApp, setActiveApp] = useState<string | null>(null);

  const selectedApp = PHONE_APPS.find((app) => app.id === activeApp);

  const formatMoney = (amount: number) =>
    new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 0,
    }).format(amount);

  function renderAppContent(app: PhoneApp) {
    if (app.id === "bank" || app.id === "wallet") {
      return (
        <div className="mt-5 rounded-3xl bg-white p-5 text-[#263d31] shadow-sm">
          <p className="text-xs font-semibold text-[#728274]">
            Available game balance
          </p>
          <p className="mt-2 text-2xl font-extrabold">
            {formatMoney(cash)}
          </p>
          <div className="mt-5 flex items-center gap-2 rounded-2xl bg-[#f1f8f2] p-3 text-sm text-[#26724f]">
            <Landmark size={18} />
            <span>Virtual account balance</span>
          </div>
          <p className="mt-4 text-xs leading-5 text-[#728274]">
            This is your current Osun Life game cash. Bank transfers and
            wallet transactions have not been implemented yet.
          </p>
        </div>
      );
    }

    if (app.id === "health") {
      return (
        <div className="mt-5 rounded-3xl bg-white p-5 text-[#263d31] shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff0f2] text-[#f04462]">
              <HeartPulse size={25} />
            </div>
            <div>
              <p className="font-bold">Player wellbeing</p>
              <p className="text-xs text-[#728274]">Osun Life</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-[#728274]">
            Your health dashboard will be connected to your game needs and
            wellbeing system in a future update.
          </p>
        </div>
      );
    }

    if (app.id === "settings") {
      return (
        <div className="mt-5 space-y-3">
          {["Phone preferences", "Notifications", "Display", "About this phone"].map(
            (item) => (
              <div
                key={item}
                className="flex items-center justify-between rounded-2xl bg-white p-4 text-sm font-medium text-[#263d31] shadow-sm"
              >
                {item}
                <ArrowUpRight size={16} className="text-[#728274]" />
              </div>
            )
          )}
        </div>
      );
    }

    return (
      <div className="mt-5 rounded-3xl bg-white p-5 text-[#263d31] shadow-sm">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl text-white"
          style={{ backgroundColor: app.color }}
        >
          <app.Icon size={28} />
        </div>
        <h3 className="mt-4 text-lg font-extrabold">{app.name}</h3>
        <p className="mt-2 text-sm leading-6 text-[#728274]">
          {app.description}
        </p>
        <div className="mt-5 flex items-start gap-2 rounded-2xl bg-[#f1f6f0] p-3 text-xs leading-5 text-[#52675a]">
          <Clock size={16} className="mt-0.5 shrink-0" />
          <span>
            This app is part of the Osun Life phone. Its full functionality
            will be added as the game develops.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center overflow-y-auto bg-[#101a18]/65 px-3 py-4 backdrop-blur-sm sm:px-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Osun Life virtual phone"
        className="relative w-full max-w-85 shrink-0 top-5"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close phone"
          title="Close phone"
          className="absolute -right-1 -top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-[#263d31] text-white shadow-lg transition hover:scale-105 sm:-right-3"
        >
          <X size={19} />
        </button>

        <div className="rounded-[44px] border-[5px] border-[#30343a] bg-[#111318] p-[7px] shadow-[0_25px_90px_rgba(0,0,0,0.55)]">
          <div className="relative flex h-[min(690px,calc(100dvh-48px))] min-h-[480px] flex-col overflow-hidden rounded-[34px] bg-[#eaf0e8]">
            <div
              className={`absolute inset-0 ${
                activeApp
                  ? "bg-[#edf2eb]"
                  : "bg-[radial-gradient(ellipse_at_15%_15%,rgba(255,255,255,0.95),transparent_35%),radial-gradient(ellipse_at_90%_25%,rgba(153,219,180,0.85),transparent_42%),linear-gradient(145deg,#a6e4c0_0%,#e6f2ce_48%,#8dc9b0_100%)]"
              }`}
            />

            <div className="relative z-10 flex h-12 shrink-0 items-center justify-between px-6 pt-1 text-[11px] font-bold text-[#192d24]">
              <span>9:41</span>
              <div className="absolute left-1/2 top-2 h-[25px] w-[94px] -translate-x-1/2 rounded-full bg-[#101114]" />
              <div className="flex items-center gap-1.5">
                <span className="text-[10px]">5G</span>
                <div className="flex h-3 items-end gap-[2px]">
                  <span className="h-1 w-[3px] rounded-sm bg-current" />
                  <span className="h-1.5 w-[3px] rounded-sm bg-current" />
                  <span className="h-2 w-[3px] rounded-sm bg-current" />
                  <span className="h-3 w-[3px] rounded-sm bg-current" />
                </div>
                <div className="h-[9px] w-[17px] rounded-[3px] border border-current p-[1px]">
                  <div className="h-full w-3/4 rounded-[1px] bg-current" />
                </div>
              </div>
            </div>

            {activeApp && selectedApp ? (
              <>
                <div className="relative z-10 flex shrink-0 items-center gap-3 px-4 pb-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveApp(null)}
                    aria-label="Back to phone home screen"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white/85 text-[#263d31] shadow-sm"
                  >
                    <ArrowLeft size={18} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#728274]">
                      Osun Life Phone
                    </p>
                    <h2 className="truncate text-lg font-extrabold text-[#263d31]">
                      {selectedApp.name}
                    </h2>
                  </div>
                </div>

                <div className="relative z-10 flex-1 overflow-y-auto px-4 pb-4">
                  {renderAppContent(selectedApp)}
                </div>
              </>
            ) : (
              <>
                <div className="relative z-10 px-5 pb-4 pt-3">
                  <p className="text-[11px] font-medium text-[#355744]">
                    {new Date().toLocaleDateString("en-NG", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </p>
                  <h2 className="mt-1 text-[27px] font-extrabold tracking-tight text-[#20392b]">
                    Hello, {username}
                  </h2>
                  <p className="mt-1 text-xs font-medium text-[#476b56]">
                    Welcome to your Osun Life phone.
                  </p>
                </div>

                <div className="relative z-10 grid grid-cols-4 gap-x-2 gap-y-5 px-4 pt-4">
                  {PHONE_APPS.map((app) => (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => setActiveApp(app.id)}
                      className="group flex min-w-0 flex-col items-center gap-1.5 rounded-xl text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#26724f]"
                    >
                      <span
                        className="flex h-[52px] w-[52px] items-center justify-center rounded-[16px] text-white shadow-[0_5px_12px_rgba(32,55,42,0.17)] transition-transform duration-150 group-hover:-translate-y-1 group-active:scale-95"
                        style={{ backgroundColor: app.color }}
                      >
                        <app.Icon size={25} strokeWidth={2.1} />
                      </span>
                      <span className="max-w-full truncate text-[10px] font-bold text-[#243d2d] [text-shadow:0_1px_8px_rgba(255,255,255,0.7)]">
                        {app.name}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="relative z-10 mx-4 mt-auto mb-4 rounded-[25px] border border-white/50 bg-white/45 p-3 backdrop-blur-md">
                  <div className="flex items-center justify-between gap-2">
                    {DOCK_APPS.map((id) => {
                      const app =
                        PHONE_APPS.find((item) => item.id === id) ??
                        PHONE_APPS[0];
                      const DockIcon = app.Icon;

                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setActiveApp(id)}
                          aria-label={`Open ${app.name}`}
                          className="flex h-[49px] w-[49px] items-center justify-center rounded-[15px] text-white shadow-sm transition-transform hover:-translate-y-1"
                          style={{ backgroundColor: app.color }}
                        >
                          <DockIcon size={25} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            <button
              type="button"
              onClick={() => setActiveApp(null)}
              aria-label="Return to phone home screen"
              title="Home"
              className="relative z-10 mx-auto mb-2 mt-auto h-1 w-[100px] shrink-0 rounded-full bg-[#263d31]/70"
            />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-center gap-2 text-center text-[11px] font-medium text-white/85">
          <Check size={13} />
          <span>Osun Life · Virtual phone</span>
        </div>
      </div>
    </div>
  );
}