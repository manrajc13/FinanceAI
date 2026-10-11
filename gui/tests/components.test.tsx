import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AllocationTable } from "@/components/allocation/allocation-tables";
import { AllocationDonut } from "@/components/charts/allocation-donut";
import { correlationColor } from "@/components/charts/correlation-heatmap";
import { WarningsNote } from "@/components/common/blocks";
import type { Schemas } from "@/lib/api/client";
import { groupColor, warningText } from "@/lib/labels";

describe("labels", () => {
  it("maps warning codes to text and falls back readably", () => {
    expect(warningText("concentration_threshold_exceeded")).toBe("One holding exceeds 40% of the portfolio.");
    expect(warningText("brand_new_code")).toBe("brand new code");
  });

  it("keeps group colors fixed per entity", () => {
    expect(groupColor("Technology")).toBe("var(--series-blue)");
    expect(groupColor("Other")).toBe("var(--series-other)");
    expect(groupColor("Unknown")).toBe("var(--series-other)");
  });
});

describe("WarningsNote", () => {
  it("renders an empty state and each warning", () => {
    const { rerender } = render(<WarningsNote warnings={[]} />);
    expect(screen.getByText("No concentration or overlap flags for this portfolio.")).toBeInTheDocument();
    rerender(<WarningsNote warnings={["few_material_holdings", "frontier_endpoint_selected"]} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});

describe("AllocationDonut", () => {
  it("lists every non-zero slice in the legend and labels the chart", () => {
    render(<AllocationDonut label="Test" slices={[
      { key: "a", label: "Technology", weight: 0.4, color: "red" },
      { key: "b", label: "Healthcare", weight: 0.6, color: "blue" },
      { key: "c", label: "Empty", weight: 0, color: "green" },
    ]} />);
    expect(screen.getByRole("img")).toHaveAccessibleName("Test: Technology 40%, Healthcare 60%");
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.queryByText("Empty")).not.toBeInTheDocument();
  });

  it("shows the hovered slice in the centre", () => {
    render(<AllocationDonut slices={[{ key: "a", label: "Energy", weight: 0.359, color: "red" }, { key: "b", label: "Other", weight: 0.641, color: "gray" }]} />);
    fireEvent.mouseEnter(screen.getAllByRole("listitem")[0]);
    expect(screen.getByText("35.9%")).toBeInTheDocument();
  });
});

describe("correlationColor", () => {
  it("is neutral at zero and uses dark ink on strong cells", () => {
    expect(correlationColor(0).background).toBe("rgb(240,239,236)");
    expect(correlationColor(1).ink).toBe("#ffffff");
    expect(correlationColor(0.05).ink).toBe("#0f172a");
  });
});

const allocation = {
  currency: "INR",
  display: {
    amounts: { AAA: "600.00", BBB: "399.99" }, hidden_assets: ["CCC"], hidden_amount: "0.01", total: "1000.00",
    dust_threshold: 0.005, rounding_adjustments: {}, method: "largest_remainder", notice: "",
  },
  breakdown: {
    by_ticker: [
      { ticker: "AAA", name: "Alpha", sector: "IT", group: "Technology", weight: 0.6 },
      { ticker: "BBB", name: "Beta", sector: "Energy", group: "Energy", weight: 0.39999 },
      { ticker: "CCC", name: "Gamma", sector: "Energy", group: "Energy", weight: 0.00001 },
    ],
    by_group: [], top_groups: [],
  },
} as unknown as Schemas["AllocationResponse"];

describe("AllocationTable", () => {
  it("shows visible rows, the hidden-dust row and the reconciled total", () => {
    render(<AllocationTable allocation={allocation} />);
    expect(screen.getByText("₹600.00")).toBeInTheDocument();
    expect(screen.getByText(/Small holdings below 0.5% \(CCC\)/)).toBeInTheDocument();
    expect(screen.getByText("₹0.01")).toBeInTheDocument();
    expect(screen.getByText("₹1,000.00")).toBeInTheDocument();
    expect(screen.queryByText("Gamma")).not.toBeInTheDocument();
  });
});
