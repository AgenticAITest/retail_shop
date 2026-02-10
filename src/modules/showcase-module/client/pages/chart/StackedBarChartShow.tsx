"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"

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

export function StackedBarChartShow() {

  return (
    <Card className="@container/card">
      <CardContent className="px-2 sm:px-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <BarChart data={chartData}
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

            <Bar dataKey="desktop" stackId="a" fill="#8884d8" />
            <Bar dataKey="mobile" stackId="a" fill="#82ca9d" />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
