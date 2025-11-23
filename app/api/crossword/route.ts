import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (!date) {
    return NextResponse.json({ error: "Date is required" }, { status: 400 });
  }

  const url = `https://lanacion-api.agilmenteapp.com/api/games/crossword/daily/${date}`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:145.0) Gecko/20100101 Firefox/145.0",
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "x-access-token":
          "ANONYMOUS-d602725fa0cc7df9bd3a4043a5d71c96-ANONYMOUS",
        Origin: "https://lanacion.agilmenteapp.com",
        Connection: "keep-alive",
        Referer: "https://lanacion.agilmenteapp.com/",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-site",
        Priority: "u=0",
      },
    });

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching crossword:", error);
    return NextResponse.json(
      { error: "Failed to fetch crossword data" },
      { status: 500 }
    );
  }
}
