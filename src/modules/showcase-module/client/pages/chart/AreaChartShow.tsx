"use client"

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  Card,
  CardContent
} from "@client/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@client/components/ui/chart"

export const description = "An interactive area chart"

const chartData = [
  { date: "Jan", desktop: 222, mobile: 150 },
  { date: "Feb", desktop: 97, mobile: 180 },
  { date: "Mar", desktop: 167, mobile: 120 },
  { date: "Apr", desktop: 242, mobile: 260 },
  { date: "May", desktop: 373, mobile: 290 },
  { date: "Jun", desktop: 301, mobile: 340 },
  { date: "Jul", desktop: 245, mobile: 180 },
]

const chartConfig = {
  visitors: {
    label: "Visitors",
  },
  desktop: {
    label: "Desktop",
    color: "#8884d8",
  },
  mobile: {
    label: "Mobile",
    color: "#82ca9d",
  },
} satisfies ChartConfig

export function ChartAreaShow() {

  return (
    <Card className="@container/card">
      <CardContent className="px-2 sm:px-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart data={chartData}
            margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="fillDesktop" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="fillMobile" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#82ca9d" stopOpacity={0} />
              </linearGradient>
            </defs>
            
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}

            />
            <YAxis />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  indicator="dot"
                />
              }
            />
            {/* <Area
              dataKey="mobile"
              type="monotone"
              fill="url(#fillMobile)"
              stroke="var(--color-mobile)"
            />
            <Area
              dataKey="desktop"
              type="monotone"
              fill="url(#fillDesktop)"
              stroke="var(--color-desktop)"
            /> */}

            <Area type="monotone" dataKey="desktop" stroke="#8884d8" fillOpacity={1} fill="url(#fillDesktop)" />
            <Area type="monotone" dataKey="mobile" stroke="#82ca9d" fillOpacity={1} fill="url(#fillMobile)" />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
