"use client"

import { Area, Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts"

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
  { date: "Jan", desktop: 222, mobile: 150, tablet: 100 },
  { date: "Feb", desktop: 97, mobile: 180, tablet: 80 },
  { date: "Mar", desktop: 167, mobile: 120, tablet: 90 },
  { date: "Apr", desktop: 242, mobile: 260, tablet: 110 },
  { date: "May", desktop: 373, mobile: 290, tablet: 130 },
  { date: "Jun", desktop: 301, mobile: 340, tablet: 120 },
  { date: "Jul", desktop: 245, mobile: 180, tablet: 70 },
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
  tablet: {
    label: "Tablet",
    color: "#ff7300",
  },
} satisfies ChartConfig

export function ComposedBarChartShow() {

  return (
    <Card className="@container/card">
      <CardContent className="px-2 sm:px-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <ComposedChart data={chartData}
            margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
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

            <Area type="monotone" dataKey="tablet" fill="#ff7300" stroke="#ff7300" />
            <Bar dataKey="desktop" fill="#8884d8" />
            <Line type="monotone" dataKey="mobile" stroke="#82ca9d" />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
