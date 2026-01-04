import type { ReactElement } from "react";
import { colors, formatDate, formatNumber, renderToPng } from "../index";

export interface DailySummaryData {
	date: Date;
	totalCalories: number;
	totalProtein: number;
	totalCarbs: number;
	totalFat: number;
	entryCount: number;
}

function ProgressBar({
	label,
	value,
	color,
	maxValue = 100,
}: {
	label: string;
	value: number;
	color: string;
	maxValue?: number;
}): ReactElement {
	const percentage = Math.min((value / maxValue) * 100, 100);

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				marginBottom: "20px",
				width: "100%",
			}}
		>
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					marginBottom: "8px",
				}}
			>
				<span
					style={{
						fontSize: "16px",
						fontWeight: 500,
						color: colors.text,
					}}
				>
					{label}
				</span>
				<span
					style={{
						fontSize: "16px",
						fontWeight: 600,
						color: color,
					}}
				>
					{formatNumber(value)}g
				</span>
			</div>
			<div
				style={{
					display: "flex",
					width: "100%",
					height: "12px",
					borderRadius: "6px",
					backgroundColor: colors.surface,
					overflow: "hidden",
				}}
			>
				<div
					style={{
						display: "flex",
						width: `${percentage}%`,
						height: "100%",
						backgroundColor: color,
						borderRadius: "6px",
					}}
				/>
			</div>
		</div>
	);
}

function DailySummaryTemplate({
	data,
}: {
	data: DailySummaryData;
}): ReactElement {
	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				width: "100%",
				height: "100%",
				backgroundColor: colors.background,
				padding: "40px",
				fontFamily: "Inter",
			}}
		>
			{/* Header */}
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					marginBottom: "24px",
				}}
			>
				<span
					style={{
						fontSize: "24px",
						fontWeight: 600,
						color: colors.text,
						marginBottom: "4px",
					}}
				>
					Today&apos;s Summary
				</span>
				<span
					style={{
						fontSize: "16px",
						color: colors.textSecondary,
					}}
				>
					{formatDate(data.date)}
				</span>
			</div>

			{/* Divider */}
			<div
				style={{
					display: "flex",
					width: "100%",
					height: "2px",
					backgroundColor: colors.border,
					marginBottom: "32px",
				}}
			/>

			{/* Main calorie display */}
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					marginBottom: "40px",
				}}
			>
				<span
					style={{
						fontSize: "72px",
						fontWeight: 700,
						color: colors.calories,
					}}
				>
					{formatNumber(data.totalCalories)}
				</span>
				<span
					style={{
						fontSize: "24px",
						color: colors.textSecondary,
					}}
				>
					kcal
				</span>
			</div>

			{/* Macro progress bars */}
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					width: "100%",
					marginBottom: "32px",
				}}
			>
				<ProgressBar
					label="Protein"
					value={data.totalProtein}
					color={colors.protein}
					maxValue={150}
				/>
				<ProgressBar
					label="Carbs"
					value={data.totalCarbs}
					color={colors.carbs}
					maxValue={300}
				/>
				<ProgressBar
					label="Fat"
					value={data.totalFat}
					color={colors.fat}
					maxValue={80}
				/>
			</div>

			{/* Footer */}
			<div
				style={{
					display: "flex",
					justifyContent: "center",
					padding: "16px",
					borderRadius: "12px",
					backgroundColor: colors.surface,
				}}
			>
				<span
					style={{
						fontSize: "16px",
						color: colors.textSecondary,
					}}
				>
					{data.entryCount} {data.entryCount === 1 ? "meal" : "meals"} logged
				</span>
			</div>
		</div>
	);
}

export async function renderDailySummary(
	data: DailySummaryData,
): Promise<Buffer> {
	return renderToPng(<DailySummaryTemplate data={data} />, {
		width: 600,
		height: 600,
	});
}
