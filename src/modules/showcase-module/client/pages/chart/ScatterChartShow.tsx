"use client"

import { CartesianGrid, Legend, Scatter, ScatterChart, XAxis, YAxis, ZAxis } from "recharts"

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

const chartData1 = [
  { x: 100, y: 200, z: 200 },
  { x: 120, y: 100, z: 260 },
  { x: 170, y: 300, z: 400 },
  { x: 140, y: 250, z: 280 },
  { x: 150, y: 400, z: 500 },
  { x: 110, y: 280, z: 200 },
]
const chartData2 = [
  { x: 80, y: 180, z: 180 },
  { x: 100, y: 80, z: 240 },
  { x: 140, y: 270, z: 370 },
  { x: 130, y: 240, z: 270 },
  { x: 120, y: 380, z: 480 },
  { x: 90, y: 250, z: 170 },
]

const chartConfig = {
  // x: {
  //   label: "Stature",
  //   color: "var(--chart-1)",
  // },
  // y: {
  //   label: "Weight",
  //   color: "var(--chart-2)",
  // },
  // z: {
  //   label: "Score",
  //   color: "var(--chart-3)",
  // },
} satisfies ChartConfig

export function ScatterChartShow() {

  return (
    <Card className="@container/card">
      <CardContent className="px-2 sm:px-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <ScatterChart
            margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />

            <XAxis type="number" dataKey="x" name="Stature" unit="cm" />
            <YAxis type="number" dataKey="y" name="Weight" unit="kg" />
            <ZAxis type="number" dataKey="z" range={[64, 144]} name="Score" unit="km" />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  indicator="dot"
                  formatter={(value, name, item) => {
                    // You can use the name (dataKey) to check which item is being rendered
                    return `${name} : ${value} ${item.unit}`;
                  }}
                />
              }
            />
            <Legend />

            <Scatter name="A school" data={chartData1} fill="#8884d8" />
            <Scatter name="B school" data={chartData2} fill="#82ca9d" />
          </ScatterChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
